const { InlineKeyboard } = require('grammy')
const { register } = require('../utils')

function createSubBtns(sub) {
    return new InlineKeyboard()
        .text(
            `${sub.isNotify ? '🔕 Off notification' : '🔔 On notification'} `,
            register.registerMenuData('toggle-notification', sub._id)
        )
        .text(
            '🌡️ Change threshold',
            register.registerMenuData('change-threshold', sub._id)
        )
        .row()
        .text(
            '🗑 Remove from watch list',
            register.registerMenuData('delete-sub', sub._id)
        )
}

module.exports = {
    createSubBtns,
}
