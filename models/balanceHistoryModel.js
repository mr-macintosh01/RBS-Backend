import mongoose from 'mongoose'

const balanceHistorySchema = mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
        },
        balance: {
            type: Number,
            required: true
        },
        binanceBalance: {
            type: Number,
            required: true
        },
        bybitBalance: {
            type: Number,
            required: true
        }
    },
    {
        timestamps: true,
    }
)

export const BalanceHistory = mongoose.model('BalanceHistory', balanceHistorySchema)