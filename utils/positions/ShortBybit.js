import crypto from 'crypto'
import ws from 'ws'
import Position from './Position.js'

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export default class ShortBybit extends Position {
    constructor(prediction, expirationDate, openTime, config, type, platform, status) {
        super(prediction, expirationDate, openTime, config, type, platform, status),

        this.expDateString = new Date(expirationDate).getDate() + new Date().toDateString().split(' ')[1].toUpperCase() + new Date(expirationDate).getYear() % 100

        this.demoUrl = 'https://api-demo.bybit.com'
        this.url = 'https://api.bybit.com'

        this.positionTracker = 0

        this.priceIndex = 0
        this.positionIntervalKeepAlive = 0
    }

    async findShort() {
        this.regime = 'shortSearch'

        const contracts = await this.getMarketTickers('', this.expDateString)
        
        if (!contracts) {
            console.log('Searching Stoped!')
            this.regime = 'neutral'
            this.status = 'PositionError'

            return undefined
        }

        const priceIndex = contracts[0]['underlyingPrice']
        const calls = []
        const puts = []
    
        for (let i = 0; i < contracts.length; i++) {
           
            if (contracts[i]['symbol'].split('-')[3] === 'C') {
                let strike = +contracts[i]['symbol'].split('-')[2]
    
                calls.push([strike, contracts[i]])
            } else {
                let strike = +contracts[i]['symbol'].split('-')[2]
    
                puts.push([strike, contracts[i]])
            }
        }

        calls.sort((a, b) => {
            if (a[0] === b[0]) {
                return 0
            }
            return (a[0] < b[0]) ? -1 : 1
        })
    
        puts.sort((a, b) => {
            if (a[0] === b[0]) {
                return 0
            }
            return (a[0] < b[0]) ? -1 : 1
        })

        const delta = []

        for (let i = 0; i < calls.length; i++) {
            delta.push(Math.abs(calls[i][0] - priceIndex))
        }

        let indexMin = delta.indexOf(Math.min(...delta))

        this.openShort(calls[indexMin], puts[indexMin])
    }

    async openShort(call, put) {
        this.regime = 'shortOpening'

        const posAmount = await this.calculateAllowedPositionAmount(+call[0], +call[1]['bid1Price'], +put[1]['bid1Price'], +call[1]['indexPrice'])

        this.priceIndexOpen = +call[1]['underlyingPrice']

        if (posAmount == 0) {
            this.status = 'PositionError'
            this.regime = 'neutral'
            return false
        } else if (posAmount === '') {
            console.log('Position size is lower than allowed min position size "0.01" due to too low "minAllowedSpentFromBalance" parameter!')
            this.status = 'PositionError'
            this.regime = 'neutral'
            return false
        }

        this.openPositionMarketConditions = [await this.getMarketConditions(call[1]['symbol']), await this.getMarketConditions(put[1]['symbol'])]

        await this.sendOrder(
            {
                'symbol': call[1]['symbol'],
                'quantity': posAmount
            },
            {
                'symbol': put[1]['symbol'],
                'quantity': posAmount
            },
            'Sell',
            false
        )

        const c = await this.getTradeHistory(new Date().getTime() - 1 * 60 * 1000, call[1]['symbol'])
        const p = await this.getTradeHistory(new Date().getTime() - 1 * 60 * 1000, put[1]['symbol'])

        if (!c || !p) {
            console.log('Error during getting Trading History for openPosition')
            this.regime = 'neutral'
            this.status = 'openPositionGTHError'

            return 0
        }

        this.openPositions = [c, p]

        this.positionEntryCost = +c['avgPrice'] * +c['quantity'] + +p['avgPrice'] * +p['quantity']
        this.oneStraddleSpentAmount = +c['avgPrice'] + +p['avgPrice']

        this.status = 'Open'
        this.regime = 'positionTracker'
        
        this.upperPrice = this.priceIndexOpen
        this.lowerPrice = this.priceIndexOpen

        this.startPositionTracker()
    }

    startPositionTracker() {
        this.positionTracker = new ws('wss://stream.bybit.com/v5/public/option')

        this.positionTracker.onopen = () => {
            console.log('WebSocket Bybit options PositionTracker connection is established');
        
            const contractRequest = {
                "op": "subscribe",
                "args": [
                    `tickers.${this.openPositions[0]['symbol']}`
                ],
            };
            
            this.positionIntervalKeepAlive = setInterval(() => this.positionTracker.send(JSON.stringify(contractRequest)), 10000)
        }

        this.positionTracker.onmessage = event => {
            let res = JSON.parse(event.data)

            this.priceIndex = +res['data']['underlyingPrice']

            if (this.priceIndex) {
                if (this.priceIndex > this.upperPrice) {
                    this.upperPrice = this.priceIndex
                } else if (this.priceIndex < this.lowerPrice) {
                    this.lowerPrice = this.priceIndex
                }
    
                // console.log('------------------------------')
                // console.log('closePriceUp: ' + (this.priceIndexOpen + this.oneStraddleSpentAmount * this.config['IVForClose']))
                // console.log('upperPrice: ' + this.upperPrice)
                // console.log('priceIndex: ' + this.priceIndex)
                // console.log('lowerPrice: ' + this.lowerPrice)
                // console.log('closePriceDown: ' + (this.priceIndexOpen - this.oneStraddleSpentAmount * this.config['IVForClose']))
                // console.log('------------------------------')
    
                if ((this.upperPrice > this.priceIndexOpen + this.oneStraddleSpentAmount * this.config['IVForClose'] || this.lowerPrice < this.priceIndexOpen - this.oneStraddleSpentAmount * this.config['IVForClose']) && this.regime === 'positionTracker') {
                    console.log('Short Position Closing!')
                    this.regime = 'selling'
                    this.positionTracker.close()
                    this.makeMarketClose('boundTouch')
                }
            }
        }

        this.positionTracker.onerror = (error) => {
            console.error('WebSocket Bybit options PositionTracker connection error:', error);
            this.positionTracker.close()
        };
            
        this.positionTracker.onclose = () => {
            clearInterval(this.positionIntervalKeepAlive)
            console.log('WebSocket Bybit options PositionTracker connection is closed.');
            
            if(this.regime !== 'selling') {
                setTimeout(() => {
                    this.startPositionTracker()	
                }, 10)
            }
        };
    }

    async updatePositionCurrentStatus() {
        try {
            const callTickers = await this.getMarketConditions(this.openPositions[0]['symbol'])
            const putTickers = await this.getMarketConditions(this.openPositions[1]['symbol'])

            this.positionCurrentStatus = [callTickers, putTickers]
        } catch (error) {
            console.log('Bybit SHORT Error during position updating information:')
            console.log(error)
        }
    }
    
    async sendOrder(call, put, side, reduceOnly) {
        try {
            const params = {
                'category': 'option',
                'request': [
                    {
                        'symbol': call['symbol'],
                        'side': side,
                        'orderType': 'Market',
                        'reduceOnly': reduceOnly + '',
                        'qty': call['quantity'] + '',
                        'orderLinkId': crypto.randomBytes(16).toString("hex")
                    },
                    {
                        'symbol': put['symbol'],
                        'side': side,
                        'orderType': 'Market',
                        'reduceOnly': reduceOnly + '',
                        'qty': put['quantity'] + '',
                        'orderLinkId': crypto.randomBytes(16).toString("hex")
                    }
                ]
            }
    
            const endpoint = '/v5/order/create-batch?'
    
            const apiKey = process.env.BYBIT_API_KEY_DEMO
            const secret = process.env.BYBIT_API_SECRET_DEMO
            const timestamp = Date.now().toString()
            const recvWindow = '5000'
            
            const headers = {
                'X-BAPI-SIGN-TYPE': '2',
                'X-BAPI-SIGN': this.getSignature(timestamp, recvWindow, JSON.stringify(params), secret, apiKey),
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'Content-Type': 'application/json'
            };
    
            const order = await fetch(this.demoUrl + endpoint, {'method': 'POST', 'headers': headers, 'body': JSON.stringify(params)})
            const orderJson = await order.json()
    
            console.log(orderJson['result']['list'])
            console.log(orderJson['retExtInfo']['list'])
        } catch (err) {
            console.log(err)
        }
    }

    async makeMarketClose(reason) {
        if (this.openPositions.length) {
            this.status = 'Close'

            await this.sendOrder(this.openPositions[0], this.openPositions[1], 'Buy', true)
                   
            let c = await this.getTradeHistory(new Date().getTime() - 1 * 60 * 1000, this.openPositions[0]['symbol'])
            let p = await this.getTradeHistory(new Date().getTime() - 1 * 60 * 1000, this.openPositions[1]['symbol'])
            
            if (!c || !p) {
                console.log('Error during getting Trading History for closePosition')
                this.closePositions = [{}, {}]

            } else {
                this.closePositions = [c, p]
            }

            const cmcCall = await this.getMarketConditions(this.openPositions[0]['symbol'])
            const cmcPut = await this.getMarketConditions(this.openPositions[0]['symbol'])

            this.closePositionMarketConditions = [cmcCall, cmcPut]

            this.regime = 'writingAnalytics'
            
            await this.writeAnalytics(reason)

            this.openPositions = []
        } else {
            console.log('There is no opened short positions!')
        }
    }

    async getMarketConditions(contract) {
        let marketTickers = (await this.getMarketTickers(contract))[0]

        if (!marketTickers) {
            marketTickers = {}
        }

        const compressedMarketConditions = {
            's': marketTickers['symbol'],
            'b': marketTickers['bid1Iv'],
            'a': marketTickers['ask1Iv'],
            'vo': marketTickers['markIv'],
            'bo': marketTickers['bid1Price'],
            'ao': marketTickers['ask1Price'],
            'mp': marketTickers['markPrice'],
            'd': marketTickers['delta'],
            't': marketTickers['theta'],
            'g': marketTickers['gamma'],
            'v': marketTickers['vega'],
        }

        return compressedMarketConditions
    }

    async getMarketTickers(contract='', expDate='') {
        let counter = 0

        const params = {
            'category': 'option',
            'symbol': contract,
            'baseCoin': 'BTC',
            'expDate': expDate
        }
        
        let res, json;

        while (true) {
            try{    
                res = await fetch(this.url + '/v5/market/tickers?' + new URLSearchParams(params))
                json = await res.json()

                if (json['result']['list'][0]) {
                    return json['result']['list']
                }

                if (counter >= 20) {
                    console.log('Cannot get market tickers for bybit short -> Short finding stop!')
                    return 0
                }

                ++counter

            } catch (err) {
                console.log('Error during Bybit tickers fetching in open short position: ' + err)
                console.log(err)

                if (counter >= 20) {
                    console.log('Cannot get market tickers for bybit short -> Short finding stop!')
                    return 0
                }

                ++counter
            }
        }
    }

    async getTradeHistory(startTime, symbol) {
        await sleep(5000)

        let counter = 0
        const params = {
            'category': 'option',
            'symbol': symbol,
            'baseCoin': 'BTC',
            'startTime': startTime
        }

        const endpoint = '/v5/execution/list?'

        const apiKey = process.env.BYBIT_API_KEY_DEMO
        const secret = process.env.BYBIT_API_SECRET_DEMO
        const timestamp = Date.now().toString()
        const recvWindow = '5000'
        
        const headers = {
            'X-BAPI-SIGN-TYPE': '2',
            'X-BAPI-SIGN': this.getSignature(timestamp, recvWindow, new URLSearchParams(params), secret, apiKey),
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
        }

        while(true) {
            try {
                const tradeHistory = await fetch(this.demoUrl + endpoint + new URLSearchParams(params), {'method': 'GET', 'headers': headers})
                let thj = await tradeHistory.json()
                
                if (thj['result']['list'][0]) {
                    const tradeHistoryJson = thj['result']['list'][thj['result']['list'].length - 1]
                
                    const compressedHistory = {
                        'symbol': tradeHistoryJson['symbol'],
                        'price': tradeHistoryJson['orderPrice'],
                        'avgPrice': tradeHistoryJson['execPrice'],
                        'quantity': tradeHistoryJson['execQty'],
                        'side': tradeHistoryJson['side'],
                        'fee': tradeHistoryJson['execFee'],
                        'createTime': +tradeHistoryJson['execTime'],
                        'timeInForce': ''
                    }
        
                    return compressedHistory
                }
                
                if (counter >= 20) {
                    console.log('Cannot get Trading History after 20 retries!')
                    return 0
                }

                counter++
            } catch (err) {
                console.log('Error during Bybit short getting Trade History')
                console.log(err)

                if (counter >= 20) {
                    console.log('Cannot get Trading History after 20 retries!')
                    return 0
                }

                counter++
            }
        }
    }

    async calculateAllowedPositionAmount(strike, priceCall, pricePut, indexPrice) {
        const account = await this.getBybitAccountBalance()

        const maxLoss = strike * this.config['maxDeviation'] - strike - priceCall > strike * this.config['maxDeviation'] - strike - pricePut ? strike * this.config['maxDeviation'] - strike - priceCall : strike * this.config['maxDeviation'] - strike - pricePut

        const minMM = maxLoss * 0.01 + Math.abs(-0.02) * 0.002 * indexPrice
        const IM = minMM * this.config['marginFactor']

        if (IM > account) {
            console.log('Insufficient balance for minium contract size margin: ')
            console.log('Account: ' + account)
            console.log('Min contract size margin: ' + IM)
            return 0
        }

        const maxAmountOfContracts = account / IM * 0.01

        if (maxAmountOfContracts * (priceCall + pricePut) <= account * this.config['minAllowedSpentFromBalance']) {
            console.log(maxAmountOfContracts)
            return Math.floor(maxAmountOfContracts * 100) / 100
        }
        
        return (account  * this.config['minAllowedSpentFromBalance'] / (maxAmountOfContracts * (priceCall + pricePut))) * maxAmountOfContracts < 0.01 ? '' : Math.floor((account * this.config['minAllowedSpentFromBalance'] / (maxAmountOfContracts * (priceCall + pricePut))) * maxAmountOfContracts * 100) / 100
    }

    async getBybitAccountBalance() {
        let balance = 0
        let counter = 0

        const endpoint = '/v5/account/wallet-balance?'

        const params = {
            'accountType': 'UNIFIED',
            'coin': 'USDT,USDC'
        }
       
        while (true) {
            try {
                const apiKey = process.env.BYBIT_API_KEY_DEMO
                const secret = process.env.BYBIT_API_SECRET_DEMO
                const timestamp = Date.now().toString()
                const recvWindow = '5000'
                
                const headers = {
                    'X-BAPI-SIGN-TYPE': '2',
                    'X-BAPI-SIGN': this.getSignature(timestamp, recvWindow, new URLSearchParams(params), secret, apiKey),
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-TIMESTAMP': timestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow,
                };


                const accountBalance = await fetch(this.demoUrl + endpoint + new URLSearchParams(params), {'method': 'GET', 'headers': headers})
                balance = +(await accountBalance.json())['result']['list'][0]['totalAvailableBalance']

                return balance

            } catch (err) {
                ++counter
                if (counter == 10) {
                    console.log('Position cannot be opened due to impossibility to get the available balance Bybit!')
                    console.log(err)
                    return 0
                }
            }
        }
    }

    getSignature(timestamp, recvWindow, parameters, secret, apiKey) {
        return crypto.createHmac('sha256', secret).update(timestamp + apiKey + recvWindow + parameters).digest('hex');
    }
}

