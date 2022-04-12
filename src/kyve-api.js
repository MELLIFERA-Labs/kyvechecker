const axios = require('axios').default
const KYVE_POOL_URL =
    'https://api.korellia.kyve.network/kyve/registry/v1beta1/pools?pagination.offset=0&pagination.limit=30&pagination.countTotal=true&search=&runtime=&paused=false'
const KYVE_POOL_BY_ID =
    'https://api.korellia.kyve.network/kyve/registry/v1beta1/pool'
const KYVE_POOL_VALIDATORS_URL =
    'https://api.korellia.kyve.network/kyve/registry/v1beta1/stakers_list'

const getPoolByIdUrl = (id) => `${KYVE_POOL_BY_ID}/${id}`
const getPoolValidatorsByIdUrl = (id) => `${KYVE_POOL_VALIDATORS_URL}/${id}`
const log = require('./logger').Logger('api')

async function getAllPools() {
    return (await axios.get(KYVE_POOL_URL)).data.pools
}

async function getPoolById(poolId) {
    return (await axios.get(getPoolByIdUrl(poolId))).data.pool
}

async function getPoolValidators(poolId) {
    try {
        const pool = await getPoolById(poolId)
        const validators = (await axios.get(getPoolValidatorsByIdUrl(poolId)))
            .data.stakers
        pool.lowest_amount = validators.find(
            (it) => it.account === pool.lowest_staker
        )?.amount
        return validators
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((it, index) => ({ ...it, recent_position: index + 1, pool }))
    } catch (e) {
        log.error(e.message)
        return null
    }
}

async function getAllValidator() {
    const allPools = await getAllPools()
    const promiseValidator = allPools.map(async (pool) => {
        const validators = (await axios.get(getPoolValidatorsByIdUrl(pool.id)))
            .data.stakers
        const lowest_validator = validators.find(
            (it) => it.account === pool.lowest_staker
        )
        return validators
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((validator, index) => {
                return {
                    ...validator,
                    pool: { ...pool, lowest_amount: lowest_validator.amount },
                    recent_position: index + 1,
                }
            })
    })
    return (await Promise.all(promiseValidator)).flat()
}
module.exports = {
    getPoolValidators,
    getAllValidator,
}
