const { BigNumber } = require('bignumber.js')

function toHumanReadable(amount) {
    return new BigNumber(amount)
        .dividedBy(new BigNumber(10).exponentiatedBy(18))
        .toFixed(5)
}
function Register() {
    const DELIMITER = '@$%^@'
    function registerMenuData(namespace, keyboardData) {
        return `inline:${namespace}${DELIMITER}${keyboardData}`
    }
    function getMenuData(keyboardData) {
        return keyboardData.split(DELIMITER)
    }
    return {
        registerMenuData,
        getMenuData,
    }
}

module.exports = {
    toHumanReadable,
    register: Register(),
}
