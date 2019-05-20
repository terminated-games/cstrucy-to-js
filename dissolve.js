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
  S64: 8,
  S64BE: 9,

  U8: 10,
  U16: 11,
  U32: 12,
  U8BE: 13,
  U16BE: 14,
  U32BE: 15,
  U64: 16,
  U64BE: 17,

  STRING: 18,
  BUFFER: 19,

  FLOAT: 20,
  FLOATBE: 21,

  DOUBLE: 22,
  DOUBLEBE: 23,

  UNDEFINED: 24,

  RESULT: 25,
  PACK: 26,

  // TODO: Consider supporting array type
  // ARRAY: 27
}

const TASK = {
  END: 0,
  START: 1,
  INDEX: 2
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

    this.route = TASK.END
    this.index = 0
  }

  async execute() {
    let task = this.queue.shift()

    if (task === undefined) return

    let fn = task.fn

    switch (task.type) {
      case TYPE.LOOP:
      this.route = TASK.INDEX
      this.index = 0

      if (await Promise.resolve(fn.call(this))) {
        this.do(task)
      }

      this.route = TASK.END
      break

      case TYPE.PACK:
      this.vars = task.vars[task.name] = {}
      break

      case TYPE.RESULT:
      this.vars = task.vars
      break

      case TYPE.TAP:
      this.index = 0
      this.route = TASK.INDEX

      if (task.name) {
        this.do({
          type: TYPE.PACK,
          vars: this.vars,
          name: task.name
        })
      }

      await Promise.resolve(fn.call(this))
      
      if (task.name) {
        this.do({
          type: TYPE.RESULT,
          vars: this.vars
        })
      }

      this.route = TASK.END
      break

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
        return this.do(task, TASK.START)
      }

      this.vars[task.name] = await Promise.resolve(fn.call(this.buffer, 0))

      this.buffer.consume(task.length)
      break

      case TYPE.STRING:

      break

      case TYPE.BUFFER:

      break

      default:
      throw new Error(`Unhandled task type: ${task.type}`)
    }

    await this.execute()
  }

  _transform(chunk, encoding, resolve) {
    this.buffer.append(chunk)

    this.execute()
    .then(resolve)
    .catch(resolve)
  }

  do(task, route) {
    switch (route || this.route) {
      case TASK.END:
      return this.queue.push(task)

      case TASK.START:
      return this.queue.unshift(task)

      case TASK.INDEX:
      return this.queue.splice(this.index++, 0, task)
    }
  }

  s32(name) {
    this.do({
      type: TYPE.S32,
      fn: this.buffer.readInt32LE,
      length: 4,
      name
    })

    return this
  }

  tap() {
    switch (arguments.length) {
      case 1: {
        let [fn] = arguments

        this.do({
          type: TYPE.TAP,
          fn
        })
      } break

      case 2: {
        let [name, fn] = arguments

        this.do({
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

        this.do({
          type: TYPE.LOOP,
          fn
        })
      } break

      default:
      throw new Error('Loop requires a function in argument 1')
    }

    return this
  }

  // array() {
  //   switch (arguments.length) {
  //     case 2:
  //     let [name, fn] = arguments

  //     this.do({
  //       type: TYPE.ARRAY,
  //       index: 0,
  //       fn,
  //       name
  //     })
  //     break

  //     case 3:
  //     let [name, length, fn] = arguments

  //     this.do({
  //       type: TYPE.ARRAY,
  //       index: 0,
  //       length,
  //       fn,
  //       name
  //     })
  //     break

  //     default:
  //     throw new Error(`Array requires name, [length] and function`)      
  //   }
  // }

  s32le() {
    return this.s32(...arguments)
  }

  u32(name) {
    this.do({
      type: TYPE.U32,
      fn: this.buffer.readUInt32LE,
      length: 4,
      name
    })
  }

}

module.exports = Dissolve

let compiler = new Dissolve

// let index = 0

async function getType(id) {
  return id
}

compiler.loop(function (){
  this.tap('header', async function () {
    this.s32('lolek')
    this.s32('lolek2')
    this.s32('lolek3')

    this.tap(async () => {
      let data = this.vars
      if (data.type === undefined) {
        data.type = await getType(data.lolek)
      }
    })

    this.tap(() => {
      switch (this.vars.type) {
        case 0:
        this.s32('world')
        break

        case 1:
        this.s32('hello')
        this.tap('mięsny', async function () {
          this.s32('kabanos')
        })
        break
      }
    })

    let index = 0
    this.loop(() => {
      if (++index === 10) return false

      console.log('index:', index)
    
      this.tap(() => {
        console.log('push to array item')
      })

      return true
    })

    this.s32('lolek4')
  })
  .tap(() => {
    this.push(this.vars)
    this.vars = {}
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
  console.log('writing:', 20)
  let test = Buffer.alloc(50)
  test.writeInt32LE(Math.random() > 0.5 ? 1 : 0)

  compiler.write(test)
}, 3000)