import { spawnSync } from 'child_process'

import { DataVector } from '../models/dataVectorModel.js'
import { Predictions } from '../models/predictionModel.js'
import { BinanceOptionsHistory } from '../models/binanceOptionsHistoryModel.js'
import { BybitOptionsHistory } from '../models/bybitOptionsHistoryModel.js'

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

export default async function gatherAnalytics() {
    console.log('gather analytics invoke: ' + new Date(Date.now()).toISOString())

    let yesterdayTime = new Date(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]).getTime()
    let timeNow = yesterdayTime + 24 * 60 * 60 * 1000

    const analytics = {'date': new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

    let fatalError = false
    let volatilityToday = await getVolatilityToday(yesterdayTime)
    let daySin = Math.sin(yesterdayTime * 2 * Math.PI / (7 * 24 * 60 * 60))
    let dayCos = Math.cos(yesterdayTime * 2 * Math.PI / (7 * 24 * 60 * 60))
    let bitVol = await getBitVolToday(timeNow)
    await sleep(20000)
    let liquidations =  getLiquidationsToday(yesterdayTime)

    if (volatilityToday == 0 || bitVol == 0 || liquidations[1] == 0 || liquidations[3] == 0) {
        console.log('Fatal error occurred during DataVector parametrs gathering!')
        fatalError = true
    }

    console.log('Yesterday time: ' + yesterdayTime)
    console.log('Time now: ' + timeNow)
    console.log('Volatility: ' + volatilityToday)
    console.log('Sin: ' + daySin)
    console.log('Cos: ' + dayCos)
    console.log('Liquidations: ' + liquidations)
    console.log('bitVol: ' + bitVol)

    analytics['vector'] = [
        volatilityToday,
        daySin,
        dayCos,
        bitVol,
        liquidations[1],
        liquidations[3]
    ]

    let res = await DataVector.create(analytics)
    console.log(res)
    console.log('data writed')
    
    let prediction = await getPredictionFromTodayToTomorrow(analytics['vector'])

    console.log(prediction)

    let binanceOpen = await getBinanceOptionsInfo(timeNow + 32 * 60 * 60 * 1000, timeNow)
    let binanceClose = await getBinanceOptionsInfo(timeNow + 8 * 60 * 60 * 1000, yesterdayTime)

    if (binanceOpen) {
        const newBinanceHistory = {
            'open': binanceOpen,
            'close': binanceClose
        }
    
        let binanceHistoryQuery = await BinanceOptionsHistory.create(newBinanceHistory)
        console.log(binanceHistoryQuery)    
    } else {
        console.log('Fatal error occurred during Binance Options Open')
        fatalError = true
    }

    
    let bybitOpen = await getBybitOptionsInfo(timeNow + 32 * 60 * 60 * 1000, timeNow)
    let bybitClose = await getBybitOptionsInfo(timeNow + 8 * 60 * 60 * 1000, yesterdayTime)

    if (bybitOpen) {
        const newBybitHistory = {
            'open': bybitOpen,
            'close': bybitClose
        }
    
        let bybitHistoryQuery = await BybitOptionsHistory.create(newBybitHistory)
        console.log(bybitHistoryQuery)
    } else {
        console.log('Fatal error occurred during Bybit Options Open')
        fatalError = true
    }

    return [prediction['prediction'], binanceOpen, bybitOpen, timeNow, analytics, fatalError]
}

async function getVolatilityToday(yesterdayTime) {
    const market_url = 'https://api3.binance.com'
    const endpoint = '/api/v3/uiKlines?'
    let counter = 0

    let volatilityToday = 0

    let params = {
        'symbol': 'BTCUSDT',
        'interval': '1d',
        'startTime': yesterdayTime,
        'endTime': yesterdayTime
    }

    while(true) {
        try {
            const response = await fetch(market_url + endpoint + new URLSearchParams(params).toString())
            const json = await response.json()
    
            volatilityToday = (+(json[json.length-1][2]) - (+json[json.length-1][3]))/(+json[json.length-1][1])

            break
        } catch (err) {
            console.log('Error during volatlity fetching and calculating: \n' + err)
            ++counter
            console.log('Counter: ' + counter)
            if (counter == 10) break;
        } 
    }
    
    return volatilityToday
}

function getLiquidationsToday(to) {
    const python = spawnSync('python', ['./utils/scripts/get_liq.py', `${to}`])

    const data = python.stdout.toString()

    let liqs = data
    let [l_time, longs, s_time, shorts] = liqs.split(', ')

    return [+l_time, +longs, +s_time, +shorts]
}

async function getBitVolToday(timeNow) {
    let bitVol = 0
    let counter = 0

    const url = `https://crypto-volatility-index.p.rapidapi.com/tick/BTC/${new Date(timeNow).toISOString().split('T')[0]}-00-00-00`

    const headers = {
        "x-rapidapi-key": "7ee640e0f7msh4deee4ab8dfb75ap1f4b3ajsn4b4433ba72bc",
        "x-rapidapi-host": "crypto-volatility-index.p.rapidapi.com"
    }

    while (true) {
        try {
            const response = await fetch(url, {'method': 'GET', 'headers': headers})
            const json = await response.json()
    
            bitVol = json
            break
        } catch (err) {
            console.log('Error during getBitVol: ' + err)
            ++counter
            console.log('Counter: ' + counter)

            if (counter == 10) break;
        }
    }

    return bitVol['value']
}

async function getPredictionFromTodayToTomorrow(vector) {
    const python = spawnSync('python', ['./utils/scripts/make_prediction.py', `${vector[0]}`, `${vector[1]}`, `${vector[2]}`, `${vector[3]}`,
    `${vector[4]}`, `${vector[5]}`])
    
    const res = +python.stdout.toString()
    const predictions = {
        'date': new Date(Date.now()).toISOString().split('T')[0],
        'prediction': res,
    }
    
    let query = await Predictions.create(predictions)
    
    console.log('Predictions ready!')
    return query
}

async function getBinanceOptionsInfo(expiryDate, time) {
    const options_url = 'https://eapi.binance.com'
    const endpoint = '/eapi/v1/exchangeInfo'
    
    let counter = 0

    while(true) {
        try {
            const response = await fetch(options_url + endpoint)
            const priceIndex = await fetch(options_url + '/eapi/v1/index?' + new URLSearchParams({'underlying': 'BTCUSDT'}).toString())
    
            console.log("Symbols status code: " + response.status)
            console.log("Price index status code: " + priceIndex.status)
    
            const json = await response.json()
            const priceIndexJson = await priceIndex.json()
    
            const btcusdtContracts = []
    
            const putsComposite = []
            const  callsComposite = []
            
            for (let i = 0; i < json['optionSymbols'].length; i++) {
                
                if (json['optionSymbols'][i]['underlying'] === 'BTCUSDT' 
                    && json['optionSymbols'][i]['expiryDate'] == expiryDate) {
    
                    btcusdtContracts.push(json['optionSymbols'][i])
    
                    if (json['optionSymbols'][i]['side'] === 'CALL') {
                        callsComposite.push([+json['optionSymbols'][i]['strikePrice'], json['optionSymbols'][i]['symbol']])
    
                    } else {
                        putsComposite.push([+json['optionSymbols'][i]['strikePrice'], json['optionSymbols'][i]['symbol']])
                    }
                }
            }
    
            callsComposite.sort((a, b) => {
                if (a[0] === b[0]) {
                    return 0
                }
                return (a[0] < b[0]) ? -1 : 1
            })
    
            putsComposite.sort((a, b) => {
                if (a[0] === b[0]) {
                    return 0
                }
                return (a[0] < b[0]) ? -1 : 1
            })
            
            const composite = []
    
            for (let i = 0; i < callsComposite.length; i++) {
                composite.push([callsComposite[i][0], callsComposite[i][1], putsComposite[i][1]])
            }
    
            const delta = []
    
            for (let i = 0; i < composite.length; i++) {
                delta.push(Math.abs(composite[i][0] - Number(priceIndexJson['indexPrice'])))
            }
     
            let indexMin = delta.indexOf(Math.min(...delta))
    
            const callsMarketPrice = []
            const putsMarketPrice = []
    
            for (let i = 0; i < 3; i++) {
                let res1 = await fetch(options_url + '/eapi/v1/mark?' + new URLSearchParams({'symbol': composite[indexMin - 1 + i][1]}).toString())
                let res2 = await fetch(options_url + '/eapi/v1/mark?' + new URLSearchParams({'symbol': composite[indexMin - 1 + i][2]}).toString())
    
                let callFetch = await res1.json()
                let putFetch = await res2.json()
    
                callsMarketPrice.push(...callFetch)
                putsMarketPrice.push(...putFetch)
            }
    
            const obj = {
                'date': new Date(time).toISOString().split('T')[0],
                'Calls': callsMarketPrice,
                'Puts': putsMarketPrice,
                'priceIndex': +priceIndexJson['indexPrice'],
                'expirationDate': expiryDate,
            }
             
            return obj
    
        } catch (err) {
            console.log('Error during Binance options gathering information: \n' + err)
            console.log(err)

            if (counter == 10) {
                return 0
            }
            
            counter++
        }
    }
    
}

async function getBybitOptionsInfo(expiryDate, time)  {
    let counter = 0
    
    while(true) {
        try {
            const bybitUrl = 'https://api.bybit.com'
            const instrumentInfoEndpoint = '/v5/market/instruments-info?'
        
            let instrumentsInfo = 0
        
            const instrumentParams = {
                'category': 'option',
                'limit': 1000,
            }
        
            let response = await fetch(bybitUrl + instrumentInfoEndpoint + new URLSearchParams(instrumentParams))
            let data = await response.json()
        
            console.log("Instruments status code: " + response.status)
        
            instrumentsInfo = data['result']['list']
        
            const calls = []
            const puts = []
        
            for (let i = 0; i < instrumentsInfo.length; i++) {
                if (+instrumentsInfo[i]['deliveryTime'] == expiryDate) {
                    if (instrumentsInfo[i]['optionsType'] === 'Call') {
                        let strike = +instrumentsInfo[i]['symbol'].split('-')[2]
        
                        calls.push([strike, instrumentsInfo[i]['symbol']])
                    } else {
                        let strike = +instrumentsInfo[i]['symbol'].split('-')[2]
        
                        puts.push([strike, instrumentsInfo[i]['symbol']])
                    }
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
        
            const contractsInfoComposite = []
        
            for(let i = 0; i < calls.length; i++) {
                contractsInfoComposite.push([calls[i][0], calls[i][1], puts[i][1]])
            }
        
            let underlyingPrice = 0
        
            const endpoint = '/v5/market/tickers?'
            
            const params = {
                'category': 'option',
                'symbol': contractsInfoComposite[0][1],
            }
            
            response = await fetch(bybitUrl + endpoint + new URLSearchParams(params))
            data = await response.json()
        
            console.log("Underlying price status code: " + response.status)
        
            underlyingPrice = +data['result']['list'][0]['underlyingPrice']
        
            const delta = []
        
            for (let i = 0; i < contractsInfoComposite.length; i++) {
                delta.push(Math.abs(contractsInfoComposite[i][0] - underlyingPrice))
            }
        
            let indexMin = delta.indexOf(Math.min(...delta))
        
            const callsMarketPrice = []
            const putsMarketPrice = []
        
            for (let i = 0; i < 3; i++) {
                let callFetch = 0
                let putFetch = 0
                
                let res1 = await fetch(bybitUrl + endpoint  + new URLSearchParams({'category': 'option', 'symbol': contractsInfoComposite[indexMin - 1 + i][1]}).toString())
                
                let res2 = await fetch(bybitUrl + endpoint + new URLSearchParams({'category': 'option', 'symbol': contractsInfoComposite[indexMin - 1 + i][2]}).toString())
        
                let data1 = await res1.json()
                callFetch = data1['result']['list'][0]
        
                let data2 = await res2.json()
                putFetch = data2['result']['list'][0]
        
                
                callsMarketPrice.push({
                    "ask1IV": callFetch['ask1Iv'],
                    "ask1Price": callFetch['ask1Price'],
                    "ask1Size": callFetch['ask1Size'],
                    "bid1IV": callFetch['bid1Iv'],
                    "bid1Price": callFetch['bid1Price'],
                    "bid1Size": callFetch['bid1Size'],
                    "delta": callFetch['delta'],
                    "gamma": callFetch['gamma'],
                    "markIV": callFetch['markIv'],
                    "markPrice": callFetch['markPrice'],
                    "openInterest": callFetch['openInterest'],
                    "symbol": callFetch['symbol'],
                    "theta": callFetch['theta'],
                    "vega": callFetch['vega']
                })
        
                putsMarketPrice.push({
                    "ask1IV": putFetch['ask1Iv'],
                    "ask1Price": putFetch['ask1Price'],
                    "ask1Size": putFetch['ask1Size'],
                    "bid1IV": putFetch['bid1Iv'],
                    "bid1Price": putFetch['bid1Price'],
                    "bid1Size": putFetch['bid1Size'],
                    "delta": putFetch['delta'],
                    "gamma": putFetch['gamma'],
                    "markIV": putFetch['markIv'],
                    "markPrice": putFetch['markPrice'],
                    "openInterest": putFetch['openInterest'],
                    "symbol": putFetch['symbol'],
                    "theta": putFetch['theta'],
                    "vega": putFetch['vega']
                })
            }
        
            const obj = {
                'date': new Date(time).toISOString().split('T')[0],
                'Calls': callsMarketPrice,
                'Puts': putsMarketPrice,
                'priceIndex': underlyingPrice,
                'expirationDate': expiryDate
            }
        
            return obj
        
        } catch (err) {
            console.log('Error during Bybit options gathering information: \n' + err)
            console.log(err)

            if (counter == 10) {
                return 0
            }

            counter++;
        }    
    }
}