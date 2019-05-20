const ITEM = require('@application/item-type')


module.exports.test = {
    pack: async function pack_test(data = {}) {
        this.int32(data.test)

        return this
    },
    unpack: async function unpack_test() {
        this.int32('test')

        return this
    },
    size: null
}

module.exports.inventory_item = {
    pack: async function pack_inventory_item(data = {}) {
        this.int32(data.id)
            .int32(data.x)
            .int32(data.y)
        switch (data.type) {
            case ITEM.PET:
                this.int32(data.growth)
                break;
            default:
                this.int16(data.enchant)
                    .int16(data.combine)
                break;
        }
        this.int32(data.test)

        return this
    },
    unpack: async function unpack_inventory_item() {
        this.int32('id')
            .int32('x')
            .int32('y')

            .tap(async function() {
                let data = this.vars
                if (data.type === undefined) {
                    data.type = await ITEM.getItemType(data.id)
                }
            })
            .tap(async function() {
                let data = this.vars
                switch (data.type) {
                    case ITEM.PET:
                        this.int32('growth')
                        break;
                    default:
                        this.int16('enchant')
                            .int16('combine')
                        break;
                }
            })
        this.int32('test')

        return this
    },
    size: null
}

module.exports.character = {
    pack: async function pack_character(data = {}) {
        this.pack([4, 13, 13], this.text, data.name, null)
            .pack([64], this.struct, data.inventory, 'inventory_item')

        return this
    },
    unpack: async function unpack_character() {
        this
        return this
    },
    size: null
}