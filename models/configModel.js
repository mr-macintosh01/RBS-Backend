import mongoose from 'mongoose'

const configSchema = mongoose.Schema(
    {
        LONG: {
            predToIVOpenParam: {
                type: Number,
                required: true
            },
            deltaThreshold: {
                type: Number,
                required: true
            },
            realzVolThreshold: {
                type: Number,
                required: true
            },
            minAllowedSpentFromBalance: {
                type: Number,
                required: true
            },
            trailingStopPercentage: {
                type: Number,
                required: true
            }
        },
        SHORT: {
            IVForClose: {
                type: Number,
                required: true
            },
            minAllowedSpentFromBalance: {
                type: Number,
                required: true
            },
            maxDeviation: {
                type: Number,
                required: true
            },
            marginFactor: {
                type: Number,
                required: true
            }
        }
    },
    {
        timestamps: true,
    }
)

export const Config = mongoose.model('Config', configSchema)