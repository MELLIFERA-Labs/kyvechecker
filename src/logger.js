const { Logger } = require('tslog')
const log = new Logger()

module.exports = {
    Logger: (name) => {
        return log.getChildLogger({ name })
    },
}
