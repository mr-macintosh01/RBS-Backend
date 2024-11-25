import ws from 'ws'
import crypto from 'crypto'
import Position from './Position.js'

export default class LongBinance extends Position {
    constructor (prediction, expirationDate, openTime, config, type, platform, status) {
        super(prediction, expirationDate, openTime, config, type, platform, status)

        this.url = 'https://eapi.binance.com'
        this.optionDeltaTracker = 0
        this.positionTracker = 0

        this.atOpenRealizedVol = 0

        this.priceIndex = 0
        
        this.trailingStopSide = ''
        this.trailingStopPrice = 0
        this.trailingStopPercentage = 0

        this.positionCurrentStatus = 0
    }

    startDeltaTracker() {
        this.regime = 'deltaTracker'

        this.optionDeltaTracker = new ws(`wss://nbstream.binance.com/eoptions/ws/BTC@ticker@${this.expirationDate}`)


        this.optionDeltaTracker.onopen = () => {
            console.log('WebSocket Binance options DeltaTracker connection is established')
        }
        
        this.optionDeltaTracker.onmessage = (event) => {
            // console.log('Received message Binance Options DeltaTracker: ');
            const res = JSON.parse(event.data)
            
            let calls = []
            let puts = []

            
            for (let i = 0; i < res.length; i++) {            
                if (res[i]['s'].split('-')[3] === 'C') {
                    calls.push([+res[i]['s'].split('-')[2], res[i]])
                } else {
                    puts.push([+res[i]['s'].split('-')[2], res[i]])
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
                delta.push(Math.abs((+calls[i][1]['d'])+(+puts[i][1]['d'])))
            }

            let indexMin = delta.indexOf(Math.min(...delta))

            console.log(delta[indexMin])
            console.log(`${calls[indexMin][1]['s']}: ${calls[indexMin][1]['d']}`)
            console.log(`${puts[indexMin][1]['s']}: ${puts[indexMin][1]['d']}`)
            
            if ((delta[indexMin] <= this.config['deltaThreshold']) && this.regime === 'deltaTracker') {
                this.regime = 'volatilityVerification'
                this.openPositionMarketConditions = [calls[indexMin][1], puts[indexMin][1]]
                this.verifyVolatility([calls[indexMin][1]['s'], puts[indexMin][1]['s']])

                this.optionDeltaTracker.close()
            }
        }

        this.optionDeltaTracker.onerror = (error) => {
            console.error('WebSocket Binance options DeltaTracker connection error:', error);        
            this.optionDeltaTracker.close()
        };
            
        this.optionDeltaTracker.onclose = () => {
            console.log('WebSocket Binance options DeltaTracker connection is closed.');
        };
    }

    async verifyVolatility(symbols) {
        this.regime = 'volatilityVerification'
        const vol = await this.getVolatility()
        const allowedPositionAmount = await this.calculateAllowedPositionAmount(symbols)
        
        if (!allowedPositionAmount) {
            console.log('Min position cost for Binance LONG exceeds MarginBalance allowed value!')
            this.status = 'PositionError'
            return false
        }
        
        if (vol > this.config['realzVolThreshold'] || vol == 0) {
            console.log('Too Hight Realized Volatility For Today or error encountered during volatility fetcing')
            this.status = 'PositionError'

            return false
        } else {
            
            this.openPositions = await this.sendOrder(
                [symbols[0], symbols[1]],
                'asks',
                'BUY',
                allowedPositionAmount,
                'false',
            )

            const res = await fetch(this.url + `/eapi/v1/index?underlying=BTCUSDT`)
            const json = await res.json()

            this.positionEntryCost = +this.openPositions[0]['avgPrice'] * +this.openPositions[0]['quantity'] + +this.openPositions[1]['avgPrice'] * +this.openPositions[1]['quantity']

            this.oneStraddleSpentAmount = (+this.openPositions[0]['price']) + (+this.openPositions[1]['price'])

            this.priceIndexOpen = +json['indexPrice']
            this.atOpenRealizedVol = vol

            this.status = 'Open'
            this.regime = 'positionTracker'
    
            this.upperPrice = this.priceIndexOpen
            this.lowerPrice = this.priceIndexOpen
    
    
            this.startPositionTracker()
        }
    }
    
    async sendOrder(symbols, bookType, side, quantity, reduceOnly) {
        let performed = false
        const orders = []

        const endpointPlaceOrder = '/eapi/v1/order?'
        const endpointOrderbook = '/eapi/v1/depth?'
        
        const headers = {
            'X-MBX-APIKEY': process.env.BINANCE_API_KEY
        }

        for (let i = 0; i < 2; i++) {
            while(!performed) {
                const res = await fetch(this.url + endpointOrderbook + new URLSearchParams({'symbol': symbols[i], 'limit': 10}))
                const json = await res.json()
                
                const schema = {
                    'symbol': symbols[i],
                    'price': json[bookType][0][0],
                    'quantity': quantity,
                    'side': side,
                    'type': 'LIMIT',
                    'reduceOnly': reduceOnly,
                    'timeInForce': 'FOK',
                    'newOrderRespType': 'RESULT',
                    'timestamp': Date.now()
                }

                schema['signature'] = this.makeSignature(new URLSearchParams(schema).toString())

                const position = await fetch(this.url + endpointPlaceOrder + new URLSearchParams(schema), {'method': 'POST', 'headers': headers})
                const positionJson = await position.json()
                
                if ('code' in positionJson) {
                    if (positionJson['code'] == -2010 && positionJson['msg'] === 'New order rejected: FOK') {
                        console.log(`${symbols[i]}: ` + positionJson.toString())
                        continue
                    }
                }

                performed = true
                orders.push(positionJson)
            }
            performed = false
        }

        console.log(`Straddle ${side}!`)
        console.log(orders)
        return orders
    }

    startPositionTracker() {

        this.positionTracker = new ws('wss://nbstream.binance.com/eoptions/ws/BTCUSDT@index')


        this.positionTracker.onopen = () => {
            console.log('WebSocket Binance options PositionTracker connection is established')
        }
        
        this.positionTracker.onmessage = (event) => {
            console.log('Received message Binance Options PositionTracker: ')
            const res = JSON.parse(event.data)
            this.priceIndex = +res['p']

            if (this.priceIndex) {
                if (this.priceIndex > this.upperPrice) {
                    this.upperPrice = this.priceIndex
                } else if (this.priceIndex < this.lowerPrice) {
                    this.lowerPrice = this.priceIndex
                }
    
                if (this.upperPrice - this.priceIndexOpen > this.oneStraddleSpentAmount && !trailingStopSide) {
                    console.log('Set trailing stop UP!')
                    this.trailingStopSide = 'UP'
                    this.this.trailingStopPrice = this.priceIndex
                    this.trailingStopPercentage = 1 - this.config['trailingStopPercentage']
                } else if (this.priceIndexOpen - this.lowerPrice > this.oneStraddleSpentAmount && !this.trailingStopSide) {
                    console.log('Set trailing stop DOWN!')
                    this.trailingStopSide = 'DOWN'
                    this.trailingStopPrice = this.priceIndex
                    this.trailingStopPercentage = 1 + this.config['trailingStopPercentage']
                }
    
                if ((this.priceIndex > this.trailingStopPrice && this.trailingStopSide === 'UP') || (this.priceIndex < this.trailingStopPrice && this.trailingStopSide === 'DOWN')) {
                    this.trailingStopPrice = this.priceIndex
                }
    
                if (((this.trailingStopSide === 'UP' && this.priceIndex < this.trailingStopPrice * this.trailingStopPercentage) || (this.trailingStopSide === 'DOWN' && this.priceIndex > this.trailingStopPrice * this.trailingStopPercentage)) && this.regime === 'positionTracker') {
                    console.log('Long Position Closing!')
                    this.regime = 'selling'
                    this.positionTracker.close()
                    this.makeMarketClose('trailingStopTouch')
                }
    
                console.log(this.upperPrice)
                console.log(this.priceIndex)
                console.log(this.lowerPrice)
                console.log(this.trailingStopSide)
                console.log(this.trailingStopPrice)
                console.log(this.trailingStopPercentage)
                console.log('Trigger price: ' + (this.trailingStopPrice * this.trailingStopPercentage))    
            }
        }

        this.positionTracker.onerror = (error) => {
            console.error('WebSocket Binance options PositionTracker connection error:', error);
            this.positionTracker.close()
        };
            
        this.positionTracker.onclose = () => {
             console.log('WebSocket Binance options PositionTracker connection is closed.');

            if(this.regime !== 'selling') {
                setTimeout(() => {
                    this.startPositionTracker()	
                }, 10)
            }
        };
    }

    async makeMarketClose(reason) {
        if (this.openPositions.length) {
            this.status = 'Close'

            this.closePositions = await this.sendOrder(
                [this.openPositions[0]['symbol'], this.openPositions[1]['symbol']],
                'bids',
                'SELL',
                this.openPositions[0]['quantity'],
                'true'
            )

            this.closePositionMarketConditions = [await this.getMarketInfo(this.openPositions[0]['symbol']), await this.getMarketInfo(this.openPositions[1]['symbol'])]
            
            this.regime = 'writingAnalytics'

            await this.writeAnalytics(reason)
            
            this.openPositions = []
        } else {
            console.log('There is no opend positions!')
        } 
    }

    async updatePositionCurrentStatus() {
        try {
            const callMark = await this.getMarketInfo(this.openPositions[0]['symbol'])
            const putMark = await this.getMarketInfo(this.openPositions[1]['symbol'])
            
            const callOrderBook = await fetch(this.url + '/eapi/v1/depth?' + new URLSearchParams({'symbol': this.openPositions[0]['symbol'], 'limit': 10}))
            const callOrderBookJson = await callOrderBook.json()
    
            const putOrderBook = await fetch(this.url + '/eapi/v1/depth?' + new URLSearchParams({'symbol': this.openPositions[1]['symbol'], 'limit': 10}))
            const putOrderBookJson = await putOrderBook.json()
    
            this.positionCurrentStatus = [
                {
                    ...callMark,
                    'bo': callOrderBookJson['bids'][0][0], 
                    'ao': callOrderBookJson['asks'][0][0],
                }, 
                {
                    ...putMark,
                    'bo': putOrderBookJson['bids'][0][0], 
                    'ao': putOrderBookJson['asks'][0][0],
                }
            ]
        } catch (error) {
            console.log('Binance LONG Error during position updating information:')
            console.log(error)
        }
        
    }

    async getAccountBalance() {
        let balance = 0
        let counter = 0

        const endpoint = '/eapi/v1/account?'
    
        while (true) {
            try {    
                const params = {
                    'timestamp': Date.now(),
                }

                const headers = {
                    'X-MBX-APIKEY': process.env.BINANCE_API_KEY
                }
                
                params['signature'] = this.makeSignature(new URLSearchParams(params).toString())

                const res = await fetch(this.url + endpoint + new URLSearchParams(params), {'method': 'GET', 'headers': headers})

                balance = +(await res.json())['asset'][0]['available']

                return balance
            } catch (err) {
                ++counter
                if (counter == 10) {
                    console.log('Cannot get the available balance Binance!')
                    return 0
                }
            }
        }
    }
   
    makeSignature(query_string) {
        return crypto
        .createHmac('sha256', process.env.BINANCE_API_SECRET)
        .update(query_string)
        .digest('hex');
    }

    async getMarketInfo(contract) {
        const marketInfo = await fetch(this.url + '/eapi/v1/mark?' + new URLSearchParams({'symbol': contract}))
        const marketInfoJson = await marketInfo.json()

        const compressedMarketInfo = {
            's': marketInfoJson[0]['symbol'],
            'b': marketInfoJson[0]['bidIV'],
            'a': marketInfoJson[0]['askIV'],
            'vo': marketInfoJson[0]['markIV'],
            'bo': '',
            'ao': '',
            'mp': marketInfoJson[0]['markPrice'],
            'd': marketInfoJson[0]['delta'],
            't': marketInfoJson[0]['theta'],
            'g': marketInfoJson[0]['gamma'],
            'v': marketInfoJson[0]['vega'],
        }
        return compressedMarketInfo
    }

    async calculateAllowedPositionAmount(symbols) {
        const marginBalance = +await this.getAccountBalance() 
        const margingBalanceThreshold = 0.9
        
        const bestPrices = []
        for (let i = 0; i < 2; i++) {
            const orderBook = await fetch(this.url + '/eapi/v1/depth?' + new URLSearchParams({'symbol': symbols[i], 'limit': 10}))
    
            const orderBookJson = await orderBook.json()
    
            bestPrices.push(+orderBookJson['asks'][0][0])
        }
        
        const res = await fetch(this.url + `/eapi/v1/index?underlying=BTCUSDT`)
        const indexPrice = +(await res.json())['indexPrice']
        
        const minContractSize = 0.01
    
        const minPositionCost = bestPrices[0] * minContractSize + (Math.min(0.0003 * indexPrice, 0.1 * bestPrices[0]) * minContractSize) + bestPrices[1] * minContractSize + (Math.min(0.0003 * indexPrice, 0.1 * bestPrices[1]) * minContractSize) 
    
        if (minPositionCost >= marginBalance * margingBalanceThreshold) {
            return false
        } else if (minPositionCost >= this.config['minAllowedSpentFromBalance'] * marginBalance) {
            return minContractSize
        } else {
            const allowedSpent = marginBalance * this.config['minAllowedSpentFromBalance']
            const positionContractsAmount = +(minContractSize * allowedSpent/minPositionCost).toFixed(2)
    
            return positionContractsAmount
        }
    }
    
}