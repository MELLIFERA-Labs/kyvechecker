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
    const pools = (await axios.get(KYVE_POOL_URL)).data.pools
    const poolsWithMinStake = pools.map(async (pool) => {
        const validators = (await axios.get(getPoolValidatorsByIdUrl(pool.id)))
            .data.stakers
        const minStaker = validators.find(
            (it) => it.account === pool.lowest_staker
        )
        return {
            ...pool,
            min_stake: minStaker.amount,
            numberOfStakers: pool.stakers.length,
        }
    })
    return Promise.all(poolsWithMinStake)
}

async function getPoolById(poolId) {
    try {
        return (await axios.get(getPoolByIdUrl(poolId))).data.pool
    } catch (e) {
        if (e?.response?.data?.code === 3) return null
        throw e
    }
}

async function getValidatorsByPoolId(poolId) {
    try {
        const validators = (await axios.get(getPoolValidatorsByIdUrl(poolId)))
            .data.stakers
        return validators
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((it, index) => ({ ...it, recent_position: index + 1 }))
    } catch (e) {
        log.error(e.message)
        return null
    }
}

async function getAllValidator() {
    const allPools = (await axios.get(KYVE_POOL_URL)).data.pools
    const promiseValidator = allPools.map(async (pool) => {
        const validators = await getValidatorsByPoolId(pool.id)
        return validators
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .map((validator, index) => {
                return {
                    ...validator,
                    recent_position: index + 1,
                }
            })
    })
    return (await Promise.all(promiseValidator)).flat()
}

module.exports = {
    getValidatorsByPoolId,
    getAllValidator,
    getPoolById,
    getAllPools,
}
