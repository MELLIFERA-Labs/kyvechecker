const { BigNumber } = require('bignumber.js')
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
function toHumanReadable(amount) {
    return numberWithCommas(
        new BigNumber(amount).dividedBy(1000000000).toFixed(2).toString()
    )
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
