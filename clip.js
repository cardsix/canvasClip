(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    //AMD
    define(factory)
  } else if (typeof exports === 'object') {
    //CommonJS
    module.exports = factory()
  } else {
    //浏览器全局变量(root 即 window)
    root.clip = factory()
  }
}(this, function() {

  'use strict'
  /*
   *源图的显示模式
   *COVER:覆盖模式
   *CONTAIN:包含模式
   */
  const SHOW_TYPE = {
    COVER: 'COVER',
    CONTAIN: 'CONTAIN'
  }

  /*
   *蒙板背景颜色
   */
  const maskBgColor = `rgba(0,0,0,.5)`

  /*
   *默认配置
   */
  const defaultOpt = {
    showType: 'COVER',
    clipSize: {
      w: 100,
      h: 100,
      fixed: true
    },
    outPutOpt: {
      type: 'image/png',
      quality: .9
    }
  }

  /*
   *resize元素的缓冲空间
   */
  const buffer = 16

  class Clip {

    constructor(opt) {
      /*
       *合并默认配置与私有配置
       */
      opt = Object.assign({}, defaultOpt, opt)

      /*
       *裁减图片container
       */
      this.container = opt.container

      /*
       *源图文件
       */
      this.sourceFile = opt.sourceFile

      /*
       *源图的显示模式
       *COVER:覆盖模式
       *CONTAIN:包含模式
       */
      this.showType = opt.showType

      /*
       *裁减框长宽配置
       */
      this.clipSize = opt.clipSize

      /*
       *图片输出配置
       */
      this.outPutOpt = opt.outPutOpt

      /*
       *裁减图输出格式
       */
      this.clip64 = ''
      this.clipBlob = null
      this.clipArrayBuffer = null

      /*
       *原图背景canvas
       */
      this._board = document.createElement('canvas')
      this._ctx = this._board.getContext('2d')

      /*
       *裁减区域canvas
       */
      this._clipContainer = document.createElement('div')
      this._clipRect = document.createElement('canvas')
      this._clipCtx = this._clipRect.getContext('2d')

      /*
       *源图背景canvas起始位置
       */
      this._startPoint = {
        x: 0,
        y: 0
      }

      /*
       *移动背景canvas时的点击位置
       */
      this._downPoint = {
        x: 0,
        y: 0
      }

      /*
       *背景canvas的可移动x,y范围
       */
      this._posRange = {
        x: [],
        y: []
      }

      /*
       *背景canvas的坐标位置
       */
      this._clipRectPos = {
        x: 0,
        y: 0
      }

      /*
       *点击时clip的size
       */
      this._downClipSize = {
        w: 0,
        h: 0
      }

      /*
       *是否点击canvas,否则不触发move事件
       */
      this._isMouseDown = false

      /*
       *是否点击在resize框中
       */
      this._resizeTarget = null


      /*
       *缓存背景canvas
       *用于绘制裁减canvas
       */
      this._boardImage = null

      this._init()
    }

    async _init() {
      /*
       *初始化container
       */
      this.container.innerHTML = ''
      this.container.style.cssText = `position:relative;overflow:hidden;background-color:${maskBgColor}`

      /*
       *获取源图Image对象
       */
      const sourceImg = await this._readImage()

      /*
       *获取背景canvas的Image对象
       */
      this._boardImage = await this._drawIamge(sourceImg)

      /*
       *绘制蒙板
       */
      this._drawMask()

      /*
       *背景图canvas可移动
       */
      this._makeMovable()

      /*
       *添加背景图canvas
       */
      this.container.appendChild(this._board)

      /*
       *绘制裁剪canvas
       */
      this._drawClip()

      /*
       *添加裁剪canvas
       *make movable
       */
      this._clipRectInit()


    }


    _readImage() {

      return new Promise((resolve, reject) => {

        const sourceImg = new Image

        sourceImg.onload = () => {
          URL.revokeObjectURL(this.sourceFile)
          resolve(sourceImg)
        }

        sourceImg.src = URL.createObjectURL(this.sourceFile)

      })

    }

    _setPosRange() {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const clipSize = this.clipSize

      const board = this._board
      const boardWidth = board.width
      const boardHeight = board.height

      const spaceX = (containerWidth - clipSize.w) / 2
      const spaceY = (containerHeight - clipSize.h) / 2
      this._posRange.x = [-(boardWidth + spaceX - containerWidth), spaceX]
      this._posRange.y = [-(boardHeight + spaceY - containerHeight), spaceY]

    }

    _drawIamge(sourceImg) {

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const boxRatio = container.clientWidth / container.clientHeight
      const imgRatio = sourceImg.width / sourceImg.height
      let boardWidth, boardHeight, x, y

      const clipSize = this.clipSize

      const strategyA = function() {
        boardWidth = containerWidth
        boardHeight = boardWidth / imgRatio
        x = 0
        y = (containerHeight - boardHeight) / 2
      }
      const strategyB = function() {
        boardHeight = containerHeight
        boardWidth = boardHeight * imgRatio
        x = (containerWidth - boardWidth) / 2
        y = 0
      }


      if (this.showType === SHOW_TYPE.CONTAIN) {
        imgRatio >= boxRatio ? strategyA() : strategyB()
      } else if (this.showType === SHOW_TYPE.COVER) {
        imgRatio >= boxRatio ? strategyB() : strategyA()
      }

      this._clipRectPos.x = x
      this._clipRectPos.y = y

      this._startPoint.x = x
      this._startPoint.y = y

      const board = this._board
      board.width = boardWidth
      board.height = boardHeight
      board.style.cssText = `transform:translate3d(${x}px,${y}px,0);will-change:transform`

      this._setPosRange()

      this._ctx.drawImage(sourceImg, 0, 0, sourceImg.width, sourceImg.height, 0, 0, boardWidth, boardHeight)

      return new Promise((resolve, reject) => {
        const image = new Image
        image.onload = () => {
          resolve(image)
        }
        image.src = board.toDataURL('image/png',1)
      })

    }

    _drawMask() {

      const board = this._board
      const ctx = this._ctx

      ctx.fillStyle = maskBgColor
      ctx.fillRect(0, 0, board.width, board.height)

    }

    _makeMovable() {

      this._board.addEventListener('mousedown', this._down.bind(this), false)
      document.addEventListener('mousemove', this._move.bind(this), false)
      document.addEventListener('mouseup', this._up.bind(this), false)

    }

    _down(e) {

      this._downPoint.x = e.pageX
      this._downPoint.y = e.pageY

      this._downClipSize.w = this.clipSize.w
      this._downClipSize.h = this.clipSize.h

      this._isMouseDown = true

    }

    _move(e) {

      const isMoveAble = this._isMouseDown && (e.target == this._board || e.target == this._clipRect) && (!this._resizeTarget)

      if (isMoveAble) {
        const posRange = this._posRange
        const clipRectPos = this._clipRectPos
        let x = e.pageX + this._startPoint.x - this._downPoint.x
        let y = e.pageY + this._startPoint.y - this._downPoint.y

        if (x < posRange.x[0]) x = posRange.x[0]
        if (x > posRange.x[1]) x = posRange.x[1]
        if (y < posRange.y[0]) y = posRange.y[0]
        if (y > posRange.y[1]) y = posRange.y[1]

        this._board.style.cssText = `transform:translate3d(${x}px,${y}px,0);will-change:transform`
        clipRectPos.x = x
        clipRectPos.y = y

        this._drawClip()
      }

    }

    _up() {

      const matrixArr = getComputedStyle(this._board, null)['transform']
        .slice(7, -1).replace(/\s+/g, '').split(',')
        .map(function(item) {
          return parseFloat(item)
        })

      this._startPoint.x = matrixArr[4]
      this._startPoint.y = matrixArr[5]

      this._isMouseDown = false

      document.removeEventListener('mousemove', this._move)
      document.removeEventListener('mouseup', this._up)

    }

    _drawClip() {

      const clipWidth = this.clipSize.w
      const clipHeight = this.clipSize.h

      const container = this.container
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      const left = (containerWidth - clipWidth) / 2
      const top = (containerHeight - clipHeight) / 2

      const board = this._board
      const srcLeft = left - this._clipRectPos.x
      const srcTop = top - this._clipRectPos.y

      const clipRect = this._clipRect
      const clipCtx = this._clipCtx

      clipCtx.clearRect(0, 0, containerWidth, containerHeight)

      clipRect.width = clipWidth
      clipRect.height = clipHeight

      clipCtx.drawImage(this._boardImage, srcLeft, srcTop, clipWidth, clipHeight, 0, 0, clipWidth, clipHeight)

      this._clipContainer.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${clipWidth}px;height:${clipHeight}px;z-index:1`

      this._setPosRange()

    }

    _clipRectInit() {

      const canvas = this._clipRect
      const clipContainer = this._clipContainer

      function createSpan(id) {
        const span = document.createElement('span')
        const css = `position:absolute;width:${2*buffer}px;height:${2*buffer}px;z-index:2;user-select:none`
        switch (id) {
          case 'ltSPAN':
            {
              span.style.cssText = `${css};left:${-buffer}px;top:${-buffer}px;cursor:nw-resize`
              break
            }
          case 'ltSPAN':
            {
              span.style.cssText = `${css};left:${-buffer}px;bottom:${-buffer}px;cursor:sw-resize`
              break
            }
          case 'rtSPAN':
            {
              span.style.cssText = `${css};right:${-buffer}px;top:${-buffer}px;cursor:ne-resize`
              break
            }
          case 'rbSPAN':
            {
              span.style.cssText = `${css};right:${-buffer}px;bottom:${-buffer}px;cursor:se-resize`
              break
            }
        }
        span.id = id
        clipContainer.appendChild(span)
      }

      ['ltSPAN', 'lbSPAN', 'rtSPAN', 'rbSPAN'].forEach(createSpan)

      // 点击事件委托给父元素
      clipContainer.addEventListener('mousedown', this._down.bind(this), false)
      clipContainer.addEventListener('mousedown', this._bindClipEvent.bind(this), false)

      clipContainer.appendChild(canvas)
      this.container.appendChild(clipContainer)
    }

    _bindClipEvent(e) {

      this._resizeTarget = e.target.id

      document.addEventListener('mousemove', this._clipRectMove.bind(this), false)
      document.addEventListener('mouseup', this._clipRectUp.bind(this), false)

    }

    _clipRectMove(e) {

      if (this._isMouseDown) {

        const clipRect = this._clipRect

        const offX = e.offsetX
        const offY = e.offsetY
        const disX = (e.pageX - this._downPoint.x) * 2
        const disY = (e.pageY - this._downPoint.y) * 2

        const clipW = clipRect.width
        const clipH = clipRect.height

        const downClipSize = this._downClipSize
        const clipSize = this.clipSize

        function fixedClipSizeHeight() {
          clipSize.h = clipSize.w * downClipSize.h / downClipSize.w
        }

        switch (this._resizeTarget) {

          case 'ltSPAN':
            {
              clipSize.w = downClipSize.w - disX
              if (clipSize.fixed) {
                fixedClipSizeHeight()
              } else {
                clipSize.h = downClipSize.h - disY
              }
              break
            }

          case 'lbSPAN':
            {
              clipSize.w = downClipSize.w - disX
              if (clipSize.fixed) {
                fixedClipSizeHeight()
              } else {
                clipSize.h = downClipSize.h + disY
              }
              break
            }

          case 'rtSPAN':
            {
              clipSize.w = downClipSize.w + disX
              if (clipSize.fixed) {
                fixedClipSizeHeight()
              } else {
                clipSize.h = downClipSize.h - disY
              }
              break
            }

          case 'rbSPAN':
            {
              clipSize.w = downClipSize.w + disX
              if (clipSize.fixed) {
                fixedClipSizeHeight()
              } else {
                clipSize.h = downClipSize.h + disY
              }
              break
            }

        }

        clipSize.w = clipSize.w <= 2 * buffer ? 2 * buffer : clipSize.w
        clipSize.h = clipSize.h <= 2 * buffer ? 2 * buffer : clipSize.h

        this._drawClip()

      }

    }

    _clipRectUp() {

      this._resizeTarget = null

      document.removeEventListener('mousemove', this._clipRectMove)
      document.removeEventListener('mouseup', this._clipRectUp)

    }

    async getClip() {

      this.clip64 = this._clipRect.toDataURL(this.outPutOpt.type,this.outPutOpt.quality)

      const binary = await this._outPutBinary()
      this.clipBlob = binary.blob
      this.clipArrayBuffer = binary.arrayBuffer

      return Promise.resolve()

    }

    _outPutBinary() {

      const self = this
      return new Promise(function(resolve, reject) {

        const clip64Arr = self.clip64.split(',')
        const type = clip64Arr[0].match(/:(.*?);/)[1]
        const str = atob(clip64Arr[1])
        let len = str.length

        const ab = new ArrayBuffer(len)
        const dv = new Uint8Array(ab)

        while (len--) {
          dv[len] = str.charCodeAt(len)
        }

        resolve({
          blob: new Blob([dv], {
            type
          }),
          arrayBuffer: dv.buffer
        })

      })

    }

  }

  function clip(container, sourceFile, showType) {

    return new Clip(container, sourceFile, showType)

  }

  return clip

}))