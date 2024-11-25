import mongoose from 'mongoose'

const dataVectorSchema = mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
        },
        vector: {
            type: 'Array',
            default: [],
            required: true,
        }
    },
    {
        timestamps: true,
    }
)

export const DataVector = mongoose.model('DataVector', dataVectorSchema)