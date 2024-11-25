import mongoose from 'mongoose'

const predictionsSchema = mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
        },
        prediction: {
            type: Number,
            required: true,
        }
    },
    {
        timestamps: true,
    }
)

export const Predictions = mongoose.model('Predictions', predictionsSchema)