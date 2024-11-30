import express from 'express'
import cors from 'cors'
import WebSocketHub from './settingUpSockets.js'
import gatherAnalytics from './utils/gatherAnalytics.js'
import tradeToday from './utils/tradeToday.js'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

import { Config } from './models/configModel.js'
import { Predictions } from './models/predictionModel.js'
import { DataVector } from './models/dataVectorModel.js'
import { BinanceOptionsHistory } from './models/binanceOptionsHistoryModel.js'
import { BybitOptionsHistory } from './models/bybitOptionsHistoryModel.js'
import { BalanceHistory } from './models/balanceHistoryModel.js'
import { PositionsHistory } from './models/positionsHistory.js'

dotenv.config()

const webSocketHub = new WebSocketHub(0, 0, 'analytics')
webSocketHub.timeSocketSetUp()

const PORT = process.env.PORT ?? 3001

const app = express()

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    console.log('Home')
    return res.send('Welcome to Algorithm')

})

app.get('/start', (req, res) => {
    console.log(req.originalUrl)
    webSocketHub.setTradingRegime('start')
    webSocketHub.show()
    
    return res.send('Start')
})

app.get('/softStop', (req, res) => {
    console.log(req.originalUrl)

    if ('status' in webSocketHub.position) {
        if (webSocketHub.position.status === 'Open') {
            webSocketHub.setTradingRegime('softStop')
            webSocketHub.show()

            return res.send('Soft Stop')
        }
    }

    webSocketHub.setTradingRegime('analytics')
    webSocketHub.show()

    return res.send('There are no opened positions!')
})

app.get('/hardStop', (req, res) => {
    console.log(req.originalUrl)

    if ('status' in webSocketHub.position) {
        if (webSocketHub.position.status === 'Open') {
            webSocketHub.setTradingRegime('analytics')
            
            webSocketHub.position.regime = 'selling'
            webSocketHub.position.positionTracker.close()
            webSocketHub.position.makeMarketClose('hardStop')
        
            return res.send('Hard Stop')
        } 
    }

    webSocketHub.setTradingRegime('analytics')
    webSocketHub.show()
    return res.send('There are no opened positions!')
})

app.get('/getData', async (req, res) => {
    console.log('data')
    let positionInfo = {text:'There is no opened positions!', status: false}

    if ('status' in webSocketHub.position) {
        if (webSocketHub.position.status === 'Open') {
            positionInfo = {
                'text': 'Opened',
                'status': true,
                'platform': webSocketHub.position.platform,
                'type': webSocketHub.position.type,
                'openPositions': webSocketHub.position.openPositions,
                'positionEntryCost': webSocketHub.position.positionEntryCost,
                'priceIndexOpen': webSocketHub.position.priceIndexOpen,
                'priceIndex': webSocketHub.position.priceIndex,
                'oneStraddleSpentAmount': webSocketHub.position.oneStraddleSpentAmount,
                'upperPrice': webSocketHub.position.upperPrice,
                'lowerPrice': webSocketHub.position.lowerPrice,
                'atOpenRealizedVol': webSocketHub.position.atOpenRealizedVol,
                'trailingStopSide': webSocketHub.position.trailingStopPercentage,
                'trailingStopPrice': webSocketHub.position.trailingStopPrice,
                'trailingStopPercentage': webSocketHub.position.trailingStopPercentage,
                'openPositionMarketConditions': webSocketHub.position.openPositionMarketConditions,
                'config': webSocketHub.position.config
            }
        }
    }
    
    const binanceBalance = await webSocketHub.getBinanceAccountBalance()
    const bybitBalance = await webSocketHub.getBybitAccountBalance()


    const data = {
        'balanceData': {
            'balance': binanceBalance + bybitBalance,
            'binanceBalance': binanceBalance,
            'bybitBalance': bybitBalance
        },  
        'analytics': {
            'serverTime': webSocketHub.time,
            'tradingRegime': webSocketHub.tradingRegime,
            'prediction': webSocketHub.prediction,
            'binanceOpen': webSocketHub.binanceOpen,
            'bybitOpen': webSocketHub.bybitOpen,
            'openTime': webSocketHub.openTime,
            'dataVector': webSocketHub.dataVector
        },
        'position': positionInfo 
    }

    return res.send(JSON.stringify(data))
})

app.get('/updateCurrentPositionCost', async (req, res) => {
    if (webSocketHub.position.status === 'Open') {
        await webSocketHub.position.updatePositionCurrentStatus()
        
        console.log('current position cost updated!')
        return res.send(JSON.stringify({'positionCurrentCost': webSocketHub.position.positionCurrentStatus, 'status': true}))
    }

    console.log('There is no positions to update!')
    return res.send(JSON.stringify({'positionCurrentCost': {}, 'status': false}))
})

app.get('/price', (req, res) => {
    console.log('price')
    return res.send(webSocketHub.price)
})

app.get('/time', (req, res) => {
    console.log('time')
    return res.send(JSON.stringify({'price': webSocketHub.price, 'time': webSocketHub.time}))
})

app.get('/config', async (req, res) => {
    try {
        const config = await Config.find({})

        return res.status(200).json(config)
    } catch (err) {
        console.log(err.message)
        response.status(500).send({message: err.message})
    }
})

app.put('/config/:id', async (req, res) => {
    try {
        console.log(req.body)
        if (!req.body['LONG']['predToIVOpenParam'] ||
            !req.body['LONG']['deltaThreshold'] ||
            !req.body['LONG']['realzVolThreshold'] ||
            !req.body['LONG']['minAllowedSpentFromBalance'] ||
            !req.body['LONG']['trailingStopPercentage'] ||
            !req.body['SHORT']['IVForClose'] ||
            !req.body['SHORT']['minAllowedSpentFromBalance'] ||
            !req.body['SHORT']['maxDeviation'] ||
            !req.body['SHORT']['marginFactor']
        ) {
            return res.status(400).send({
                message: 'Send all required fields!'
            })
        }

        const { id } = req.params

        const conf = await Config.find({})
        
        if (conf.length) {
            await Config.findByIdAndUpdate(id, req.body)
            return res.status(200).send({message: 'Config updated successfully!'})
        } 

        await Config.create(req.body)

        return res.status(200).send({message: 'Config added!'})
    } catch (err) {
        console.log(err.message)
        res.status(500).send({message: err.message})
    }
})

app.post('/getAnalytics', async (req, res) => {
    try {
        const predictions = await Predictions
        .find(
            req.body['predictionQuery']['find'],
            req.body['predictionQuery']['projection'],
        )    
        .sort(
            req.body['predictionQuery']['sort']
        )

        const dataVector = await DataVector.find(
            req.body['dataVectorQuery']['find'],
            req.body['dataVectorQuery']['projection'],
        )
        .sort(
            req.body['dataVectorQuery']['sort']
        )

        const binanceOptionsHistory = await BinanceOptionsHistory.find(
            req.body['binanceOptionsHistoryQuery']['find'],
            req.body['binanceOptionsHistoryQuery']['projection'],
        )
        .sort(
            req.body['binanceOptionsHistoryQuery']['sort']
        )

        const bybitOptionsHistory = await BybitOptionsHistory.find(
            req.body['bybitOptionsHistoryQuery']['find'],
            req.body['bybitOptionsHistoryQuery']['projection'],
        )
        .sort(
            req.body['bybitOptionsHistoryQuery']['sort']
        )

        const balanceHistory = await BalanceHistory.find(
            req.body['balanceHistoryQuery']['find'],
            req.body['balanceHistoryQuery']['projection'],
        )
        .sort(
            req.body['balanceHistoryQuery']['sort']
        )

        const positionsHistory = await PositionsHistory.find(
            req.body['positionsHistoryQuery']['find'],
            req.body['positionsHistoryQuery']['projection']
        )
        .sort(
            req.body['positionsHistoryQuery']['sort']
        )

        const obj = {
            'predictions': predictions,
            'dataVector': dataVector,
            'binanceOptionsHistory': binanceOptionsHistory,
            'bybitOptionsHistory': bybitOptionsHistory,
            'balanceHistory': balanceHistory,
            'positionsHistory': positionsHistory
        }

        res.status(200).send(obj)
    } catch (err) {
        console.log(err)
        res.status(500).send({message: err.message})
    }
})

mongoose
    .connect(process.env.mongoDBURL)
    .then(() => {
        console.log('App connected to database')
        
        app.listen(PORT, () => {
            console.log(`App is listening on port ${PORT}`)
        })
    })
    .catch(error => {
        console.log(error)
    })