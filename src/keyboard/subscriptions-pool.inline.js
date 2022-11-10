const { InlineKeyboard } = require('grammy')
const { register } = require('../utils')

function createSubPoolBtns(sub) {
    return new InlineKeyboard()
        .text(
            `${
                sub.isNotifyAboutFreePlace
                    ? '🔕 Off notify about free place in pool'
                    : '🔔 On notify about free place in pool'
            } `,
            register.registerMenuData('toggle-pool-free-place', sub._id)
        )
        .row()
        .text(
            `${
                sub.isNotifyWithMinimalStake
                    ? '🔕 Off notify by min stake threshold in pool'
                    : '🔔 On notify by min stake threshold in pool'
            } `,
            register.registerMenuData('toggle-pool-min-stake', sub._id)
        )
        .row()
        .text(
            `${
                sub.minStakeThreshold
                    ? '🌡️ Change min stake threshold'
                    : '🌡️ Set min stake threshold'
            }`,
            register.registerMenuData('change-pool-threshold', sub._id)
        )
        .row()
        .text(
            '🗑 Remove from watch list',
            register.registerMenuData('delete-pool-sub', sub._id)
        )
}

module.exports = {
    createSubPoolBtns,
}
