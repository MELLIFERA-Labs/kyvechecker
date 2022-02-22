const { request, gql } = require('graphql-request')
const KYVE_GRAPHQL_URL = 'https://kyve-cache.herokuapp.com/graphql'
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
    return request('https://kyve-cache.herokuapp.com/graphql', query)
}

async function getPoolById(poolId) {
    const query = gql`
	{
	findPool(poolId: "${poolId}") {
    _id
    poolAddress
    uploadLimit
    maxFunders
    maxValidators
    minFunds
    minStake
    slashThreshold
    uploader
    kyvePerByte
    idleCost
    totalFunded
    totalStaked
    paused
    metadata {
      name
      runtime
      logo
      bundleSize
      versions
    }
  }
  
  }`
    return (await request(KYVE_GRAPHQL_URL, query)).findPool
}

async function getPoolValidators(poolId) {
    const query = gql`
 {
   findPoolValidators(poolId: "${poolId}") {
     nodeAddress
     poolAddress
     apy
     commission
     totalDelegators
     totalPoints
     totalSlashes
     totalStaked
     proposalsValidated
     isUploader
     isValidator
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
