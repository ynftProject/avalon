module.exports = (value, canBeZero, canBeNegative, max, min) => {
    if (typeof value !== 'number' && typeof value !== 'bigint' && typeof value !== 'string')
        return false
    if (typeof value !== 'number') {
        if (!min && !canBeNegative)
            min = 0n
        try {
            value = BigInt(value)
        } catch (e) {
            return false
        }
    } else {
        if (!max)
            max = BigInt(Number.MAX_SAFE_INTEGER)
        if (!min)
            if (canBeNegative)
                min = BigInt(Number.MIN_SAFE_INTEGER)
            else
                min = 0n
        if (!Number.isSafeInteger(value))
            return false
        value = BigInt(value)
    }

    try {
        if (typeof max !== 'undefined')
            max = BigInt(max)
        if (typeof min !== 'undefined')
            min = BigInt(min)
    } catch (e) {
        return false
    }

    if (!canBeZero && value === 0n)
        return false
    if (!canBeNegative && value < 0n)
        return false
    if (typeof max !== 'undefined' && value > max)
        return false
    if (typeof min !== 'undefined' && value < min)
        return false

    return true
}