import mongoose from 'mongoose'

const positionsHistorySchema = mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
        },
        priceIndexOpen: {
            type: Number,
            required: true,
        },
        priceIndexClose: {
            type: Number,
            required: true,
        },
        entryPositionCost: {
            type: Number,
            required: true,
        },
        oneStraddleSpentAmount: {
            type: Number,
            required: true,
        },
        closePositionCost: {
            type: Number,
            required: true,
        },
        profit$: {
            type: Number,
            required: true,
        },
        'profit%': {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        platform: {
            type: String,
            required: true,
        },
        closeReason: {
            type: String,
            required: true,
        },
        openTime: {
            type: String,
            required: true,
        },
        closeTime: {
            type: String,
            required: true,
        },
        predictedVol: {
            type: Number,
            required: true,
        },
        realizedVolForPosition: {
            type: Number,
            required: true,
        },
        atOpenRealizedVol: {
            type: Number,
            default: null
        },
        generalVol: {
            type: Number,
            required: true,
        },
        upperPrice: {
            type: Number,
            required: true,
        },
        upperPriceVol: {
            type: Number,
            required: true,
        },
        lowerPrice: {
            type: Number,
            required: true,
        },
        lowerPriceVol: {
            type: Number,
            required: true,
        },
        trailingStopSide: {
            type: String,
            default: null,
        },
        trailingStopPrice: {
            type: Number,
            default: null
        },
        trailingStopPercentage: {
            type: Number,
            default: null,
        },
        trailingStopActualClosePrice: {
            type: Number,
            default: null,
        },
        metadataOpen: {
            callSymbol: {
                type: String,
                required: true
            },
            callBidIV: {
                type: String,
                required: true
            },
            callAskIV: {
                type: String,
                required: true
            },
            callMarkIV: {
                type: String,
                required: true
            },
            callBidPrice: {
                type: String,
            },
            callAskPrice: {
                type: String,
            },
            callMarkPrice: {
                type: String,
                required: true
            },
            callOrderPrice: {
                type: String,
                required: true,
            },
            callOrderAvgPrice: {
                type: String,
                required: true
            },
            callOrderQuantity: {
                type: String,
                required: true
            },
            callOrderFee: {
                type: String,
                required: true
            },
            callOrderSide: {
                type: String,
                required: true
            },
            callOrderTimeInForce: {
                type: String,
            },
            callDelta: {
                type: String,
                required: true
            },
            callTheta: {
                type: String,
                required: true
            },
            callGamma: {
                type: String,
                required: true
            },
            callVega: {
                type: String,
                required: true
            },
            callCreationTime: {
                type: String,
                required: true
            },
            putSymbol: {
                type: String,
                required: true
            },
            putBidIV: {
                type: String,
                required: true
            },
            putAskIV: {
                type: String,
                required: true
            },
            putMarkIV: {
                type: String,
                required: true
            },
            putBidPrice: {
                type: String,
            },
            putAskPrice: {
                type: String,
            },
            putMarkPrice: {
                type: String,
                required: true
            },
            putOrderPrice: {
                type: String,
                required: true
            },
            putOrderAvgPrice: {
                type: String,
                required: true
            },
            putOrderQuantity: {
                type: String,
                required: true
            },
            putOrderFee: {
                type: String,
                required: true
            },
            putOrderSide: {
                type: String,
                required: true
            },
            putOrderTimeInForce: {
                type: String,
            },
            putDelta: {
                type: String,
                required: true
            },
            putTheta: {
                type: String,
                required: true
            },
            putGamma: {
                type: String,
                required: true
            },
            putVega: {
                type: String,
                required: true
            },
            putCreationTime: {
                type: String,
                required: true
            },
        },
        metadataClose: {
            callSymbol: {
                type: String,
                required: true
            },
            callBidIV: {
                type: String,
                required: true
            },
            callAskIV: {
                type: String,
                required: true
            },
            callMarkIV: {
                type: String,
                required: true
            },
            callBidPrice: {
                type: String,
            },
            callAskPrice: {
                type: String,
            },
            callMarkPrice: {
                type: String,
                required: true
            },
            callOrderPrice: {
                type: String,
                required: true
            },
            callOrderAvgPrice: {
                type: String,
                required: true
            },
            callOrderQuantity: {
                type: String,
                required: true
            },
            callOrderFee: {
                type: String,
                required: true
            },
            callOrderSide: {
                type: String,
                required: true
            },
            callOrderTimeInForce: {
                type: String,
            },
            callDelta: {
                type: String,
                required: true
            },
            callTheta: {
                type: String,
                required: true
            },
            callGamma: {
                type: String,
                required: true
            },
            callVega: {
                type: String,
                required: true
            },
            callCreationTime: {
                type: String,
                required: true
            },
            putSymbol: {
                type: String,
                required: true
            },
            putBidIV: {
                type: String,
                required: true
            },
            putAskIV: {
                type: String,
                required: true
            },
            putMarkIV: {
                type: String,
                required: true
            },
            putBidPrice: {
                type: String,
            },
            putAskPrice: {
                type: String,
            },
            putMarkPrice: {
                type: String,
                required: true
            },
            putOrderPrice: {
                type: String,
                required: true
            },
            putOrderAvgPrice: {
                type: String,
                required: true
            },
            putOrderQuantity: {
                type: String,
                required: true
            },
            putOrderFee: {
                type: String,
                required: true
            },
            putOrderSide: {
                type: String,
                required: true
            },
            putOrderTimeInForce: {
                type: String,
            },
            putDelta: {
                type: String,
                required: true
            },
            putTheta: {
                type: String,
                required: true
            },
            putGamma: {
                type: String,
                required: true
            },
            putVega: {
                type: String,
                required: true
            },
            putCreationTime: {
                type: String,
                required: true
            },
        },
        config: {
            type: [Object],
            blackbox: true
        }
    },
    {
        timestamps: true,
    }
)

export const PositionsHistory = mongoose.model('PositionsHistory', positionsHistorySchema)