require('literal-require')

const Parser = require('@application/index.js')
const Path = require('path')

const Dissolve = require('dissolve')
const Concentrate = require('concentrate')
const h = require('hexy').hexy

class Compiler extends Concentrate {
  constructor() {
    super()

    this.structures = {}
  }

  pack(array, method, data = [], struct) {
    if (!Array.isArray(array)) {
      array = []
    }
    
    if (!array.length) {
      throw new Error('Something went wrong!')
    }

    if (array.length === 1) {
      let [length] = array

      for (let i=0; i<length; i++) {
        method.call(this, data[i], this.structures[struct])
      }

      return this
    }

    let [length] = array

    for (let i=0; i<length; i++) {
      this.pack(array.slice(1), method, data[i], struct)
    }

    return this
  }

  struct(data, struct = null) {
    if (struct) {
      struct.pack.call(this, data)
    } else {
      console.log('struct not defined')
    }

    return this
  }
}

class Dissolver extends Dissolve {
  constructor() {
    super()

    this.structures = {}
  }

  struct(struct = null) {
    console.log('struct:', struct)

    struct = this.structures[struct]

    if (struct) {
      struct.unpack.call(this)
    } else {
      console.log('struct not defined')
    }

    return this
  }

  getVars() {
    let resolve_callback
    let result

    let callback = function () {
      console.log('this data:', this.vars)

      if (resolve_callback) {
        resolve_callback(this.vars)
      } else {
        result = this.vars
      }
    }

    this.tap(callback)

    return new Promise((resolve, reject) => {
      resolve({})
    })
  }
}

Parser(Path.literal('@test/test.h'))
.then(async result => {
  let structures = require(result)

  let compiler = new Compiler
  let parser = new Dissolver

  for (let name in structures) {
    console.log('name:', name)

    compiler.structures[name] = structures[name]
    parser.structures[name] = structures[name]
  }

  await structures.inventory_item.pack.call(compiler, {
    type: 1,
    enchant: 10,
    combine: 10,
    growth: 0xdead
  })

  let test = compiler.result()
  console.log('buffer:\n', h(test))

  let r = await structures.inventory_item.unpack.call(parser)
  r.tap(() => {
    parser.push(parser.vars)
    parser.vars = {}
  })

  parser.on('readable', () => {
    let chunk

    console.log('readable')

    while (chunk = parser.read()) {
      console.log(chunk)
    }
  })

  parser.write(test)

})
.catch(e => {
  console.log(e)
})