import mongoose from 'mongoose'

const bybitOptionsHistorySchema = mongoose.Schema(
    {
        open: {
            date: {
                type: String,
                required: true
            },
            Calls: [
                {
                    ask1IV: String,
                    ask1Price: String,
                    ask1Size: String,
                    bid1IV: String,
                    bid1Price: String,
                    bid1Size: String,
                    delta: String,
                    gamma: String,
                    markIV: String,
                    markPrice: String,
                    openInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            Puts: [
                {
                    ask1IV: String,
                    ask1Price: String,
                    ask1Size: String,
                    bid1IV: String,
                    bid1Price: String,
                    bid1Size: String,
                    delta: String,
                    gamma: String,
                    markIV: String,
                    markPrice: String,
                    openInterest: String,
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
                    ask1IV: String,
                    ask1Price: String,
                    ask1Size: String,
                    bid1IV: String,
                    bid1Price: String,
                    bid1Size: String,
                    delta: String,
                    gamma: String,
                    markIV: String,
                    markPrice: String,
                    openInterest: String,
                    symbol: String,
                    theta: String,
                    vega: String,
                }
            ],
            Puts: [
                {
                    ask1IV: String,
                    ask1Price: String,
                    ask1Size: String,
                    bid1IV: String,
                    bid1Price: String,
                    bid1Size: String,
                    delta: String,
                    gamma: String,
                    markIV: String,
                    markPrice: String,
                    openInterest: String,
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

export const BybitOptionsHistory = mongoose.model('BybitOptionsHistory', bybitOptionsHistorySchema)
