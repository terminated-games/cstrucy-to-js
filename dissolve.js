const { Transform } = require('stream')
const BufferList = require('bl')

const TYPE = {
  LOOP: 0,
  TAP: 1,
  
  S8: 2,
  S16: 3,
  S32: 4,
  S8BE: 5,
  S16BE: 6,
  S32BE: 7,
  S64: 20,
  S64BE: 21,

  U8: 8,
  U16: 9,
  U32: 10,
  U8BE: 11,
  U16BE: 12,
  U32BE: 13,
  U64: 22,
  U64BE: 23,

  STRING: 14,
  BUFFER: 15,

  FLOAT: 16,
  FLOATBE: 17,

  DOUBLE: 18,
  DOUBLEBE: 19,

  UNDEFINED: 24,

  RESULT: 25
}

class Dissolve extends Transform {
  constructor(options = {}) {

    if (options.objectMode === undefined) {
      options.objectMode = true
    }

    super(options)

    this.vars = {}
    this.queue = []
    this.buffer = new BufferList()
  }

  async execute() {
    let task = this.queue.shift()

    if (task === undefined) return

    let fn = task.fn

    switch (task.type) {
      case TYPE.LOOP:
      if ( await Promise.resolve(fn.call(this)) ) {
        this.queue.push(task)
      }
      break

      case TYPE.TAP: {
      this.tmp = this.vars
      this.vars = {}

      await Promise.resolve(fn.call(this))

      if (task.name) {
        this.tmp[task.name] = this.vars
        this.vars = this.tmp
      } else {
        this.vars = vars
      }

      } break

      case TYPE.S8:
      case TYPE.S16:
      case TYPE.S32:
      case TYPE.S8BE:
      case TYPE.S16BE:
      case TYPE.S32BE:
      case TYPE.S64:
      case TYPE.S64BE:

      case TYPE.U8:
      case TYPE.U16:
      case TYPE.U32:
      case TYPE.U8BE:
      case TYPE.U16BE:
      case TYPE.U32BE:
      case TYPE.U64:
      case TYPE.U64BE:

      case TYPE.FLOAT:
      case TYPE.FLOATBE:
      case TYPE.DOUBLE:
      case TYPE.DOUBLEBE:

      if (task.length > this.buffer.length) {
        return this.queue.unshift(task)
      }

      this.vars[task.name] = await Promise.resolve(fn.call(this.buffer, 0))

      this.buffer.consume(task.length)
      break

      case TYPE.STRING:

      break

      case TYPE.BUFFER:

      break

      default:
      await Promise.resolve(fn.call(this))
      break
    }

    await this.execute()
  }

  _transform(chunk, encoding, resolve) {
    this.buffer.append(chunk)

    this.execute()
    .then(resolve)
    .catch(resolve)
  }

  s32(name) {
    this.queue.push({
      type: TYPE.S32,
      fn: this.buffer.readInt32LE,
      length: 4,
      name
    })

    return this
  }

  getVars() {
      
  }

  tap() {
    switch (arguments.length) {
      case 1: {
        let [fn] = arguments

        this.queue.push({
          type: TYPE.TAP,
          fn
        })
      } break

      case 2: {
        let [name, fn] = arguments

        this.queue.push({
          type: TYPE.TAP,
          fn,
          name
        })
      } break

      default:
      throw new Error('Tap requires a name, function or function')
    }

    return this
  }

  loop() {
    switch (arguments.length) {
      case 1: {
        let [fn] = arguments

        this.queue.push({
          type: TYPE.LOOP,
          fn
        })
      } break

      default:
      throw new Error('Loop requires a function in argument 1')
    }
  }

  s32le() {
    return this.s32(...arguments)
  }

  u32(name) {
    this.queue.push({
      type: TYPE.U32,
      fn: this.buffer.readUInt32LE,
      length: 4,
      name
    })
  }

}

module.exports = Dissolve

let compiler = new Dissolve

let index = 0

compiler.loop(() => {
  compiler.s32('test').s32('test2').tap(() => {
    console.log('pushing result')

    compiler.push(compiler.vars)
    compiler.vars = {}
  })

  return true
})

compiler.on('readable', () => {
  let result

  while (result = compiler.read()) {
    console.log('result:', result)
  }
})

compiler.on('end', () => {
  console.log('dissolve ended')
})

// compiler.write(Buffer.alloc(4096))

setInterval(() => {
  console.log('writing:', 5)
  compiler.write(Buffer.alloc(20))
}, 3000)