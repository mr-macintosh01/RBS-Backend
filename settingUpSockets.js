import ws from 'ws'
import crypto from 'crypto'
import gatherAnalytics from './utils/gatherAnalytics.js'
import tradeToday from './utils/tradeToday.js'

import { BalanceHistory } from './models/balanceHistoryModel.js'
import { Config } from './models/configModel.js'


export default class WebSocketHub {
    constructor(price, time, tradingRegime) {
        this.binanceURL = 'https://eapi.binance.com'
        this.bybitDemoURL = 'https://api-demo.bybit.com'
        
        this.priceSocket = 0
        this.timeSocket = 0

        this.price = price
        this.time = time
        this.date = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24))

        this.tradingRegime = tradingRegime

        this.binanceBalanceSocket = 0

        this.binanceBalanceInterval = 0
        this.binanceCurrentBalance = 0

        this.bybitBalanceSocket = 0
        this.bybitBalancePingInterval = 0
        this.bybitCurrentBalance = 0

        this.position = []

        this.prediction = 0
        this.binanceOpen = 0
        this.bybitOpen = 0
        this.openTime = 0
        this.dataVector = {
            vector: []
        }

        this.fatalErrorInAnalytics = false
        this.decisionToTrade = false
    }

    async testStart() {
        this.setTradingRegime('start')
        // this.time = response.result.serverTime
        console.log('New day')
        // console.log('server time reason: ' + new Date(response.result.serverTime).toISOString())
        
        this.saveBalance()
        this.decisionToTrade = false

        const analytics = await gatherAnalytics()

        this.prediction = analytics[0]
        this.binanceOpen = analytics[1]
        this.bybitOpen = analytics[2]
        this.openTime = analytics[3]
        this.dataVector = analytics[4]
        this.fatalErrorInAnalytics = analytics[5]

        const config = (await Config.find({}))[0]

        if (this.getTradingRegime() === 'start') {
            if ('status' in this.position) {
                if (this.position.status === 'Open') {
                    await this.position.makeMarketClose('dayEnd')
                }    
            }
                
            const [p, d] = tradeToday([this.prediction, this.binanceOpen, this.bybitOpen, this.openTime, config])

            this.position = p
            this.decisionToTrade = d

        } else if (this.getTradingRegime() === 'softStop') {
            if (this.position.status === 'Open') {
                this.position.makeMarketClose('dayEnd')
            }
            
            this.setTradingRegime('analytics')
        }
    }

    timeSocketSetUp() {
        let timeIntervalSending
        
        this.timeSocket = new ws('wss://ws-api.binance.com:443/ws-api/v3')
        
        this.timeSocket.onopen = () => {
            console.log('WebSocket time connection is established.');

            const serverTimeRequest = {
                id: "922bcc6e-9de8-440d-9e84-7c80933a8d0d",
                method: "time"
            };
            
            timeIntervalSending = setInterval(() => {
                this.timeSocket.send(JSON.stringify(serverTimeRequest));
            }, 100)
        };
        
        this.timeSocket.onmessage = async (event) => {
            const response = JSON.parse(event.data);

            if (response.result.serverTime) {
                if (Math.floor(response.result.serverTime / (1000 * 60 * 60 * 24)) > this.date) {
                    console.log('Value server: ' + Math.floor(response.result.serverTime / (1000 * 60 * 60 * 24)))
                    console.log('Value date: ' + this.date)

                    this.date = Math.floor(response.result.serverTime / (1000 * 60 * 60 * 24))

                    this.time = response.result.serverTime
                    this.decisionToTrade = 'None'

                    console.log('New day')
                    console.log('server time reason: ' + new Date(response.result.serverTime).toISOString())
                    
                    if ('status' in this.position) {
                        if (this.position.status === 'Open') {
                            this.position.regime = 'selling'
                            this.position.positionTracker.close()
                            await this.position.makeMarketClose('dayEnd')
                        }    
                    }
                    
                    this.saveBalance()
    
                    const analytics = await gatherAnalytics()
                    
                    this.prediction = analytics[0]
                    this.binanceOpen = analytics[1]
                    this.bybitOpen = analytics[2]
                    this.openTime = analytics[3]
                    this.dataVector = analytics[4]
                    this.fatalErrorInAnalytics = analytics[5]

                    const config = (await Config.find({}))[0]
    
                    if (this.getTradingRegime() === 'start' && !this.fatalErrorInAnalytics) {
                        const [p, d] = tradeToday([this.prediction, this.binanceOpen, this.bybitOpen, this.openTime, config])

                        this.position = p
                        this.decisionToTrade = d
                    
                    } else if (this.getTradingRegime() === 'softStop') {
                        this.setTradingRegime('analytics')
                    }
                }
    
                this.time = response.result.serverTime
            }
        };
        
        this.timeSocket.onerror = (error) => {
            console.error('WebSocket time connection error:', error);
            
            this.timeSocket.close()
        };
        
        this.timeSocket.onclose = () => {
            console.log('WebSocket time connection is closed.');

            clearInterval(timeIntervalSending)
            setTimeout(() => {
                this.timeSocketSetUp()	
            }, 10)
        };   
    }

    async saveBalance() {
        console.log('saveBalance invoke: ' + new Date(Date.now()).toISOString())
        const binanceBalance = await this.getBinanceAccountBalance()
        const bybitBalance = await this.getBybitAccountBalance()

        const balance = binanceBalance + bybitBalance

        const newBalance = {
            'date': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            'balance': balance,
            'binanceBalance': binanceBalance,
            'bybitBalance': bybitBalance,
        }

        BalanceHistory.create(newBalance)
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
                    'X-BAPI-SIGN': this.bybitGetSignature(timestamp, recvWindow, new URLSearchParams(params), secret, apiKey),
                    'X-BAPI-API-KEY': apiKey,
                    'X-BAPI-TIMESTAMP': timestamp,
                    'X-BAPI-RECV-WINDOW': recvWindow,
                };


                const accountBalance = await fetch(this.bybitDemoURL + endpoint + new URLSearchParams(params), {'method': 'GET', 'headers': headers})

                balance = +(await accountBalance.json())['result']['list'][0]['totalMarginBalance']

                return balance

            } catch (err) {
                ++counter
                if (counter == 10) {
                    console.log('Cannot get the available balance Bybit!')
                    return 0
                }
            }
        }
    }

    async getBinanceAccountBalance() {
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
                
                params['signature'] = this.binanceMakeSignature(new URLSearchParams(params).toString())

                const res = await fetch(this.binanceURL + endpoint + new URLSearchParams(params), {'method': 'GET', 'headers': headers})

                balance = +(await res.json())['asset'][0]['equity']

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

    bybitGetSignature(timestamp, recvWindow, parameters, secret, apiKey) {
        return crypto.createHmac('sha256', secret).update(timestamp + apiKey + recvWindow + parameters).digest('hex');
    }

    binanceMakeSignature(query_string) {
        return crypto
        .createHmac('sha256', process.env.BINANCE_API_SECRET)
        .update(query_string)
        .digest('hex');
    }
    
    // startBybitBalanceTracker() {
    //     const demoEndpoint = 'wss://stream-demo.bybit.com/v5/private'
        
    //     this.bybitBalanceSocket = new ws(demoEndpoint)

    //     this.bybitBalanceSocket.onopen = () => {
    //         console.log('WebSocket Bybit options Balance connection is established.');

    //         const expires = new Date().getTime() + 600000;
    //         const signature = crypto.createHmac("sha256", process.env.BYBIT_API_SECRET_DEMO).update("GET/realtime" + expires).digest("hex");

    //         const payload = {
    //             op: "auth",
    //             args: [process.env.BYBIT_API_KEY_DEMO, expires.toFixed(0), signature],
    //         }

    //         this.bybitBalanceSocket.send(JSON.stringify(payload));
            
    //         this.bybitBalancePingInterval = setInterval(() => {
    //             this.bybitBalanceSocket.send(JSON.stringify({'op': 'ping'}))
    //         }, 1000)

    //         this.bybitBalanceSocket.send(JSON.stringify({'op': 'subscribe', 'args': ['wallet']}))
    //     }

    //     this.bybitBalanceSocket.onmessage = (event) => {
    //         console.log('Received message Bybit Options Balance: ')
    //         const res = JSON.parse(event.data)
            
    //         if ('data' in res) {
    //             this.bybitCurrentBalance = res['data'][0]
    //             console.log(this.bybitCurrentBalance)
    //         }

    //         console.log(res)
    //     }

    //     this.bybitBalanceSocket.onerror = (error) => {
    //         console.error('WebSocket Bybit options Balance connection error:', error);        
    //         this.bybitBalanceSocket.close()
    //     };
            
    //     this.bybitBalanceSocket.onclose = () => {
    //         console.log('WebSocket Bybit options Balance connection is closed.');
    //         clearInterval(this.bybitBalancePingInterval)
    //     };

    // }


    // async startBinanceBalanceTracker() {
    //     const headers = {
    //         'X-MBX-APIKEY': process.env.BINANCE_API_KEY
    //     }

    //     const res = await fetch('https://eapi.binance.com/eapi/v1/listenKey', {'method': 'POST', 'headers': headers})
    //     const json = await res.json()
        
    //     console.log(json)

    //     this.binanceBalanceInterval = setInterval(() => {
    //         fetch('https://eapi.binance.com/eapi/v1/listenKey', {'method': 'PUT', 'headers': headers})
    //         console.log('Updated listen key')
    //     }, 1800000)

    //     this.binanceBalanceSocket = new ws(`wss://nbstream.binance.com/eoptions/ws/${json['listenKey']}`)

    //     this.binanceBalanceSocket.onopen = () => {
    //         console.log('WebSocket Binance options Balance connection is established')
    //         this.binanceBalanceSocket.close()
    //     }
        
    //     this.binanceBalanceSocket.onmessage = (event) => {
    //         console.log('Received message Binance Options Balance: ')
    //         const res = JSON.parse(event.data)
            
    //         this.binanceCurrentBalance = res

    //         console.log(res)
    //     }

    //     this.binanceBalanceSocket.onerror = (error) => {
    //         console.error('WebSocket Binance options Balance connection error:', error);        
    //         this.binanceBalanceSocket.close()
    //     };
            
    //     this.binanceBalanceSocket.onclose = () => {
    //         console.log('WebSocket Binance options Balance connection is closed.');
    //         fetch('https://eapi.binance.com/eapi/v1/listenKey', {'method': 'DELETE', 'headers': headers})
    //         console.log('listenKey is Deleted')
    //         clearInterval(this.binanceBalanceInterval)
    //     };
        
    // }

    getTradingRegime() {
        return this.tradingRegime
    }

    setTradingRegime(value) {
        this.tradingRegime = value
    } 
    
    show() {
        console.log('==============================')
        console.log(`Price Socket: ${this.priceSocket}`)
        console.log(`Time Socket: ${this.timeSocket}`)
        // console.log(`Current Price $: ${this.price}`)
        console.log(`Current Time in ms: ${this.time}`)
        console.log(`Current Trading Regime: ${this.tradingRegime}`)
    }
}