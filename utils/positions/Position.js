import { PositionsHistory } from '../../models/positionsHistory.js'

export default class Position {
    constructor(prediction, expirationDate, openTime, config, type, platform, status) {
        this.prediction = prediction
        this.expirationDate = expirationDate
        this.openTime = openTime
        this.config = config
        this.platform = platform
        this.type = type
        this.status = status

        this.regime = 'neutral'

        this.priceIndexOpen = 0

        this.positionEntryCost = 0
        this.positionCurrentStatus = 0

        this.oneStraddleSpentAmount = 0

        this.openPositions = []
        this.closePositions = []

        this.upperPrice = 0
        this.lowerPrice = 0

        this.openPositionMarketConditions = 0
        this.closePositionMarketConditions = 0
    }

    async writeAnalytics(reason) {
        const vol = await this.getVolatility()

        const closePositionCost = (+this.closePositions[0]['avgPrice'] * +this.openPositions[0]['quantity']) + (+this.closePositions[1]['avgPrice'] * +this.openPositions[1]['quantity'])
        
        const schema = {
            'date': new Date(this.openTime).toISOString().split('T')[0],
            'priceIndexOpen': this.priceIndexOpen,
            'priceIndexClose': this.priceIndex,
            'entryPositionCost': this.positionEntryCost,
            'closePositionCost': closePositionCost,
            'oneStraddleSpentAmount': this.oneStraddleSpentAmount,
            'profit$': (this.type === 'SHORT' ? this.positionEntryCost - closePositionCost : closePositionCost - this.positionEntryCost) - (+this.openPositions[0]['fee'] + +this.closePositions[0]['fee']) - (+this.openPositions[1]['fee'] + +this.closePositions[1]['fee']),
            'profit%': ((this.type === 'SHORT' ? (this.positionEntryCost - closePositionCost) : (closePositionCost - this.positionEntryCost)) - (+this.openPositions[0]['fee'] + +this.closePositions[0]['fee']) - (+this.openPositions[1]['fee'] + +this.closePositions[1]['fee']))/this.positionEntryCost,
            'type': this.type,
            'platform': this.platform,
            'closeReason': reason,
            'openTime': `${new Date(this.openPositions[0]['createTime']).toISOString()}/${new Date(this.openPositions[1]['createTime']).toISOString()}`,
            'closeTime': `${new Date(this.closePositions[0]['createTime'] || 0).toISOString()}/${new Date(this.closePositions[1]['createTime'] || 0).toISOString()}`,
            'predictedVol': this.prediction,
            'realizedVolForPosition': (this.upperPrice - this.lowerPrice)/this.priceIndexOpen,
            'atOpenRealizedVol': this.type === 'SHORT' ? '' : this.atOpenRealizedVol,
            'generalVol': vol,
            'upperPrice': this.upperPrice,
            'upperPriceVol': this.upperPrice/this.priceIndexOpen,
            'lowerPrice': this.lowerPrice,
            'lowerPriceVol': this.lowerPrice/this.priceIndexOpen,
            'trailingStopSide': this.type === 'SHORT' ? '' : this.trailingStopSide,
            'trailingStopPrice': this.type === 'SHORT' ? '' : this.trailingStopPrice,
            'trailingStopPercentage': this.type === 'SHORT' ? '' : this.trailingStopPercentage,
            'trailingStopActualClosePrice': this.type === 'SHORT' ? '' : this.trailingStopPrice * this.trailingStopPercentage,
            'metadataOpen': {
                'callSymbol': this.openPositionMarketConditions[0]['s'],
                'callBidIV': this.openPositionMarketConditions[0]['b'],
                'callAskIV': this.openPositionMarketConditions[0]['a'],
                'callMarkIV': this.openPositionMarketConditions[0]['vo'],
                'callBidPrice': this.openPositionMarketConditions[0]['bo'],
                'callAskPrice': this.openPositionMarketConditions[0]['ao'],
                'callMarkPrice': this.openPositionMarketConditions[0]['mp'],
                'callOrderPrice': this.openPositions[0]['price'],
                'callOrderAvgPrice': this.openPositions[0]['avgPrice'],
                'callOrderQuantity': this.openPositions[0]['quantity'],
                'callOrderFee': this.openPositions[0]['fee'],
                'callOrderSide': this.openPositions[0]['side'],
                'callOrderTimeInForce': this.openPositions[0]['timeInForce'],
                'callDelta': this.openPositionMarketConditions[0]['d'],
                'callTheta': this.openPositionMarketConditions[0]['t'],
                'callGamma': this.openPositionMarketConditions[0]['g'],
                'callVega': this.openPositionMarketConditions[0]['v'],
                'callCreationTime': new Date(this.openPositions[0]['createTime'] || 0).toISOString(),
                'putSymbol': this.openPositionMarketConditions[1]['s'],
                'putBidIV': this.openPositionMarketConditions[1]['b'],
                'putAskIV': this.openPositionMarketConditions[1]['a'],
                'putMarkIV': this.openPositionMarketConditions[1]['vo'],
                'putBidPrice': this.openPositionMarketConditions[1]['bo'],
                'putAskPrice': this.openPositionMarketConditions[1]['ao'],
                'putMarkPrice': this.openPositionMarketConditions[1]['mp'],
                'putOrderPrice': this.openPositions[1]['price'],
                'putOrderAvgPrice': this.openPositions[1]['avgPrice'],
                'putOrderQuantity': this.openPositions[1]['quantity'],
                'putOrderFee': this.openPositions[1]['fee'],
                'putOrderSide': this.openPositions[1]['side'],
                'putOrderTimeInForce': this.openPositions[1]['timeInForce'],
                'putDelta': this.openPositionMarketConditions[1]['d'],
                'putTheta': this.openPositionMarketConditions[1]['t'],
                'putGamma': this.openPositionMarketConditions[1]['g'],
                'putVega': this.openPositionMarketConditions[1]['v'],
                'putCreationTime': new Date(this.openPositions[1]['createTime'] || 0).toISOString()
            },
            'metadataClose': {
                'callSymbol': this.closePositionMarketConditions[0]['s'],
                'callBidIV': this.closePositionMarketConditions[0]['b'],
                'callAskIV': this.closePositionMarketConditions[0]['a'],
                'callBidPrice': this.closePositionMarketConditions[0]['bo'],
                'callAskPrice': this.closePositionMarketConditions[0]['ao'],
                'callMarkIV': this.closePositionMarketConditions[0]['vo'],
                'callMarkPrice': this.closePositionMarketConditions[0]['mp'],
                'callOrderPrice': this.closePositions[0]['price'],
                'callOrderAvgPrice': this.closePositions[0]['avgPrice'],
                'callOrderQuantity': this.closePositions[0]['quantity'],
                'callOrderFee': this.closePositions[0]['fee'],
                'callOrderSide': this.closePositions[0]['side'],
                'callOrderTimeInForce': this.closePositions[0]['timeInForce'],
                'callDelta': this.closePositionMarketConditions[0]['d'],
                'callTheta': this.closePositionMarketConditions[0]['t'],
                'callGamma': this.closePositionMarketConditions[0]['g'],
                'callVega': this.closePositionMarketConditions[0]['v'],
                'callCreationTime': new Date(this.closePositions[0]['createTime'] || 0).toISOString(),
                'putSymbol': this.closePositionMarketConditions[1]['s'],
                'putBidIV': this.closePositionMarketConditions[1]['b'],
                'putAskIV': this.closePositionMarketConditions[1]['a'],
                'putMarkIV': this.closePositionMarketConditions[1]['vo'],
                'putBidPrice': this.closePositionMarketConditions[1]['bo'],
                'putAskPrice': this.closePositionMarketConditions[1]['ao'],
                'putMarkPrice': this.closePositionMarketConditions[1]['mp'],
                'putOrderPrice': this.closePositions[1]['price'],
                'putOrderAvgPrice': this.closePositions[1]['avgPrice'],
                'putOrderQuantity': this.closePositions[1]['quantity'],
                'putOrderFee': this.closePositions[1]['fee'],
                'putOrderSide': this.closePositions[1]['side'],
                'putOrderTimeInForce': this.closePositions[1]['timeInForce'],
                'putDelta':  this.closePositionMarketConditions[1]['d'],
                'putTheta': this.closePositionMarketConditions[1]['t'],
                'putGamma': this.closePositionMarketConditions[1]['g'],
                'putVega': this.closePositionMarketConditions[1]['v'],
                'putCreationTime': new Date(this.closePositions[1]['createTime'] || 0).toISOString()
            },
            'config': this.config
        }

        console.log(schema)
        
        let positionsHistoryQuery = await PositionsHistory.create(schema)

        console.log(positionsHistoryQuery)

        this.regime = 'neutral'
    }

    async getVolatility() {
        let counter = 0
        let vol = 0

        const params = {
            'symbol': 'BTCUSDT',
            'interval': '1d',
            'startTime': this.openTime,
            'endTime': this.openTime
        }

        while(true) {
            try {
                const res = await fetch('https://api3.binance.com/api/v3/uiKlines?' + new URLSearchParams(params).toString())
                const json = await res.json()
                        
                vol = (+json[0][2] - +json[0][3])/(+json[0][1])

                break
            } catch (err) {
                console.log('Error during volatlity fetching and calculating: \n' + err)
                ++counter
                console.log('Counter: ' + counter)
                if (counter == 10) break;
            }
        }

        return vol
    }

    get oneStraddleSpentAmount() {
        return this._oneStraddleSpentAmount
    }

    set oneStraddleSpentAmount(newOneStraddleSpentAmount) {
        this._oneStraddleSpentAmount = newOneStraddleSpentAmount
    }

    get upperPrice() {
        return this._upperPrice
    }

    set upperPrice(newUpperPrice) {
        this._upperPrice = newUpperPrice
    }

    get lowerPrice() {
        return this._lowerPrice
    }

    set lowerPrice(newLowerPrice) {
        this._lowerPrice = newLowerPrice
    }

    get positionCurrentStatus() {
        return this._positionCurrentStatus
    }

    set positionCurrentStatus(newPositionCurrentStatus) {
        this._positionCurrentStatus = newPositionCurrentStatus
    }

    get positionEntryCost() {
        return this._positionEntryCost
    }

    set positionEntryCost(newPositionEntryCost) {
        this._positionEntryCost = newPositionEntryCost
    }

    get regime() {
        return this._regime
    }

    set regime(newRegime) {
        this._regime = newRegime
    }
}