import('./src/index.mjs')
  .then(mod => {
    global.Table = mod.default
    console.log('Table loaded')
  })
