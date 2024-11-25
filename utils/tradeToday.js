import ShortBybit from './positions/ShortBybit.js'
import LongBinance from './positions/LongBinance.js'

export default function tradeToday(data) {
    const [prediction, binanceData, bybitData, timeNow, config] = data

    if (new Date().getDay() == 6 || new Date().getDay() == 0) {
        const expirationDate = bybitData['expirationDate']
        const shortStraddle = new ShortBybit(prediction, expirationDate, timeNow, config['SHORT'], 'SHORT', 'Bybit', 'Open')
        
        shortStraddle.findShort()
        
        return shortStraddle
    } else {
        let binanceAveIV = 0
        let bybitAveIV = 0

        for (let i = 0; i < 3; i++) {
            binanceAveIV += (+binanceData['Calls'][i]['markIV'] + +binanceData['Puts'][i]['markIV']) / 6
            bybitAveIV += (+bybitData['Calls'][i]['markIV'] + +bybitData['Puts'][i]['markIV']) / 6
        }

        // if (prediction >= binanceAveIV * config['LONG']['predToIVOpenParam'] * Math.sqrt(1/365)) {

            const expirationDate = new Date(binanceData['expirationDate']).getYear() % 100 + new Date(binanceData['expirationDate']).toISOString().split('-')[1] + String(new Date(binanceData['expirationDate'])).split(' ')[2]

            const longStraddle = new LongBinance(prediction, expirationDate, timeNow, config['LONG'], 'LONG', 'Binance', 'DeltaTracker')

            longStraddle.startDeltaTracker()

            return longStraddle
        // } 
        // else if (prediction <= bybitAveIV * Math.sqrt(1/365)) {
            // const expirationDate = bybitData['expirationDate']
            const shortStraddle = new ShortBybit(prediction, expirationDate, timeNow, config['SHORT'], 'SHORT', 'Bybit', 'findShort')

            shortStraddle.findShort()
        
            return shortStraddle
        // }

        console.log('Prediction: ' + prediction)
        console.log(`BinanceAveIV * ${config['LONG']['predToIVOpenParam']}: ` + binanceAveIV * config['LONG']['predToIVOpenParam'] * Math.sqrt(1/365))
        console.log(`BybitAveIV: ` + bybitAveIV * Math.sqrt(1/365))
        console.log('No positions')
        
        return []
    }
}