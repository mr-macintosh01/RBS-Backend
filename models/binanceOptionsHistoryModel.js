import mongoose from 'mongoose'

const binanceOptionsHistorySchema = mongoose.Schema(
    {
        open: {
            date: {
                type: String,
                required: true
            },
            Calls: [
                {
                    askIV: String,
                    bidIV: String,
                    delta: String,
                    gamma: String,
                    highPriceLimit: String,
                    lowPriceLimit: String,
                    markIV: String,
                    markPrice: String,
                    riskFreeInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            Puts: [
                {
                    askIV: String,
                    bidIV: String,
                    delta: String,
                    gamma: String,
                    highPriceLimit: String,
                    lowPriceLimit: String,
                    markIV: String,
                    markPrice: String,
                    riskFreeInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            priceIndex: {
                type: Number,
                required: true
            },
            expirationDate: {
                type: Number,
                required: true
            },
        },
        close: {
            date: {
                type: String,
                required: true
            },
            Calls: [
                {
                    askIV: String,
                    bidIV: String,
                    delta: String,
                    gamma: String,
                    highPriceLimit: String,
                    lowPriceLimit: String,
                    markIV: String,
                    markPrice: String,
                    riskFreeInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            Puts: [
                {
                    askIV: String,
                    bidIV: String,
                    delta: String,
                    gamma: String,
                    highPriceLimit: String,
                    lowPriceLimit: String,
                    markIV: String,
                    markPrice: String,
                    riskFreeInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            priceIndex: {
                type: Number,
                required: true
            },
            expirationDate: {
                type: Number,
                required: true
            },
        },
    },
    {
        timestamps: true,
    }
)

export const BinanceOptionsHistory = mongoose.model('BinanceOptionsHistory', binanceOptionsHistorySchema)
