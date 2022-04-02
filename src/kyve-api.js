const { request, gql } = require('graphql-request')
const KYVE_GRAPHQL_URL = 'https://cache.kyve.network/graphql'
const log = require('./logger').Logger('api')

async function getAllPools() {
    const query = gql`
        {
            findPools {
                poolAddress
                metadata {
                    name
                    runtime
                    logo
                }
            }
        }
    `
    return request(KYVE_GRAPHQL_URL, query)
}

async function getPoolById(poolId) {
    const query = gql`
	{
	findPool(poolId: "${poolId}") {
    _id
    poolAddress
    startHeight
    height
    poolHeight
    size
    totalRewards
    uploadTimeout
    bundleDelay
    operatingCost
    storageCost
    totalFunds
    minFunds
    totalStake
    minStake
    totalDelegation
    maxFunders
    maxValidators
    slashThreshold
    config {
      rpc
      wss
    }
    metadata {
      name
      runtime
      logo
      versions
    }
    paused
    validators
    funders
    chainIndexed
    cost
    }
  }`
    return (await request(KYVE_GRAPHQL_URL, query)).findPool
}

async function getPoolValidators(poolId) {
    const query = gql`
 {
   findPoolValidators(poolId: "${poolId}") {
        nodeId
        nodeAddress
        poolAddress
        validProposalsCreated
        personalStake
        points
        slashes
        delegators
        commission
        totalDelegationRewards
        totalDelegation
        votingPowerPercentage
        apyPercentage
   }
 }`
    try {
        const pool = await getPoolById(poolId)
        return (await request(KYVE_GRAPHQL_URL, query)).findPoolValidators.map(
            (it, recent_position) => ({ ...it, recent_position, pool })
        )
    } catch (e) {
        log.error(e)
        return null
    }
}

async function getAllValidator() {
    const allPools = await getAllPools()
    const promiseValidator = allPools.findPools.map(async (pool) => {
        const validators = await getPoolValidators(pool.poolAddress)
        return validators.map((validator, index) => {
            return { pool: { ...pool }, ...validator, position: index }
        })
    })
    return (await Promise.all(promiseValidator)).flat()
}

module.exports = {
    getPoolValidators,
    getAllValidator,
}
