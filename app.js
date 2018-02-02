/* global self */
'use strict'

const $startButton = document.querySelector('#start')
const $stopButton = document.querySelector('#stop')
const $peers = document.querySelector('#peers')
const $peersList = $peers.querySelector('ul')
const $errors = document.querySelector('#errors')
const $fileHistory = document.querySelector('#file-history tbody')
const $fileStatus = document.querySelector('#file-status')
const $multihashInput = document.querySelector('#multihash')
const $catButton = document.querySelector('#cat')
const $connectPeer = document.querySelector('#peer-input')
const $connectPeerButton = document.querySelector('#peer-btn')
const $body = document.querySelector('body')
const $idContainer = document.querySelector('.id-container')
const $addressesContainer = document.querySelector('.addresses-container')
const $allDisabledButtons = document.querySelectorAll('button:disabled')
const $allDisabledInputs = document.querySelectorAll('input:disabled')
const $allDisabledElements = document.querySelectorAll('.disabled')
const $root_hash = document.querySelector('#roothash')


let node
let info
let Buffer
let application = new Object()

/*
 * Start and stop the IPFS node
 */

function start () {
  if (!node) {
    updateView('starting', node)

    const options = {
      repo: 'ipfs-' + Math.random() + Date.now().toString(),
      config: {
        Addresses: {
          Swarm: [
            // '/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star'
           // '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
          ]
        }
      }
    }

    // IFDEV: To test with latest js-ipfs
    // const IPFS = require('ipfs')
    // node = new IPFS(options)
    // VEDIF

    // EXAMPLE
    node = new self.Ipfs(options)
    application.node = node



    Buffer = node.types.Buffer

    node.once('start', () => node.id((err, id) => {
      if (err) { return onError(err) }

      info = id
      updateView('ready', node)
      setInterval(refreshPeerList, 1000)
      $peers.classList.add('waiting')

      application.root_object = node.files.add({ path: 'ipfs-folder'}, (err,files) =>{
        if (err) { return onError(err) }
          $root_hash.value = files[0].hash
          node.object.get(files[0].hash, (err,object) => {
            if (err) { return onError(err) }
            application.root_object = object
          })
      } )

    }))
  }
}

function stop () {
  window.location.href = window.location.href // refresh page
}

function appendFile (name, hash, size, data) {
  const file = new window.Blob([data], { type: 'application/octet-binary' })
  const url = window.URL.createObjectURL(file)
  const row = document.createElement('tr')

  const nameCell = document.createElement('td')
  nameCell.innerHTML = name

  const hashCell = document.createElement('td')
  const link = document.createElement('a')
  link.innerHTML = hash
  link.setAttribute('href', url)
  link.setAttribute('download', name)
  hashCell.appendChild(link)

  const sizeCell = document.createElement('td')
  sizeCell.innerText = size

  row.appendChild(nameCell)
  row.appendChild(hashCell)
  row.appendChild(sizeCell)

  $fileHistory.insertBefore(row, $fileHistory.firstChild)
}

function getFile () {
  const cid = $multihashInput.value

  $multihashInput.value = ''

  $errors.classList.add('hidden')

  if (!cid) { return console.log('no multihash was inserted') }

  node.files.get(cid, (err, files) => {
    if (err) { return onError(err) }
console.log(files)
    files.forEach((file) => {
      if (file.content) {
        appendFile(file.name, cid, file.size, file.content)
      }
    })
  })
}

function getobject () {
  const cid = $multihashInput.value

  $multihashInput.value = ''

  $errors.classList.add('hidden')

  if (!cid) { return console.log('no multihash was inserted') }

  node.object.get(cid, (err, objects) => {
    if (err) { return onError(err) }
console.log(objects)
   
  })
}

/*
 * Drag and drop
 */
function onDrop (event) {
  onDragExit()
  $errors.classList.add('hidden')
  event.preventDefault()

  if (!node) {
    return onError('IPFS must be started before files can be added')
  }
  const dt = event.dataTransfer
  const filesDropped = dt.files

  function readFileContents (file) {
    return new Promise((resolve) => {
      const reader = new window.FileReader()
      reader.onload = (event) => resolve(event.target.result)
      reader.readAsArrayBuffer(file)
    })
  }

  const files = []
  for (let i = 0; i < filesDropped.length; i++) {
    files.push(filesDropped[i])
  }
  
  var node_files = []
  var file_promises = []

  files.forEach((file) => { 
    file_promises.push( 
      new Promise((resolve) => {
        readFileContents(file)
          .then((buffer) => {
             resolve({
                path: file.name,
                content: Buffer.from(buffer)
            })
          })       
        
      })
    )
  
  })

let current_root_object = application.root_object

//  node_files.push({ path : '/tmp2/'})
Promise.all(file_promises).then( file_structs => {
  node.files.add(
    file_structs, 
    (err, filesAdded) => {
      if (err) { return onError(err) }
      console.log(filesAdded);
      filesAdded.forEach( file => {
        node.object.get(file.hash, (err,fileobject) => {
          if (err) { return onError(err) }
          console.log(fileobject)
          let link_to_file =  fileobject.toJSON()
          link_to_file.name = file.path
          console.log(link_to_file)
          if( ! application.root_object.links.find( element => { return element.toJSON().multihash == link_to_file.multihash }) ){
            node.object.patch.addLink( application.root_object.toJSON().multihash, link_to_file, (err,new_object) => {
               if (err) { return onError(err) }
              application.root_object = new_object
              $root_hash.value        = new_object.toJSON().multihash
            })
          }
        })


      })

      $multihashInput.value = filesAdded[0].hash
    }
  )
})
}

/*
 * Network related functions
 */

// Get peers from IPFS and display them

function connectToPeer (event) {
  event.target.disabled = true
  node.swarm.connect($connectPeer.value, (err) => {
    if (err) { return onError(err) }

    $connectPeer.value = ''

    setTimeout(() => {
      event.target.disabled = false
    }, 500)
  })
}

function refreshPeerList () {
  node.swarm.peers((err, peers) => {
    if (err) {
      return onError(err)
    }
    const peersAsHtml = peers
      .map((peer) => {
        if (peer.addr) {
          const addr = peer.addr.toString()
          if (addr.indexOf('ipfs') >= 0) {
            return addr
          } else {
            return addr + peer.peer.id.toB58String()
          }
        }
      })
      .map((addr) => {
        return '<li>' + addr + '</li>'
      }).join('')

    if (peers.length === 0) {
      $peers.classList.add('waiting')
    } else {
      $peers.classList.remove('waiting')
      $peersList.innerHTML = peersAsHtml
    }
  })
}

/*
 * UI functions
 */

function onError (err) {
  let msg = 'An error occured, check the dev console'

  if (err.stack !== undefined) {
    msg = err.stack
  } else if (typeof err === 'string') {
    msg = err
  }

  $errors.innerHTML = msg
  $errors.classList.remove('hidden')
}

window.onerror = onError

function onDragEnter () {
  $body.classList.add('dragging')
}

function onDragExit () {
  $body.classList.remove('dragging')
}

/*
 * App states
 */
const states = {
  ready: () => {
    const addressesHtml = info.addresses.map((address) => {
      return '<li><span class="address">' + address + '</span></li>'
    }).join('')
    $idContainer.innerText = info.id
    $addressesContainer.innerHTML = addressesHtml
    $allDisabledButtons.forEach(b => { b.disabled = false })
    $allDisabledInputs.forEach(b => { b.disabled = false })
    $allDisabledElements.forEach(el => { el.classList.remove('disabled') })
    $stopButton.disabled = false
    $startButton.disabled = true
  },
  starting: () => {
    $startButton.disabled = true
  }
}

function updateView (state, ipfs) {
  if (states[state] !== undefined) {
    states[state]()
  } else {
    throw new Error('Could not find state "' + state + '"')
  }
}

/*
 * Boot this application!
 */
const startApplication = () => {
  // Setup event listeners
  $body.addEventListener('dragenter', onDragEnter)
  $body.addEventListener('drop', onDrop)
  $body.addEventListener('dragleave', onDragExit)

  $startButton.addEventListener('click', start)
  $stopButton.addEventListener('click', stop)
  $catButton.addEventListener('click', getFile)
  $connectPeerButton.addEventListener('click', connectToPeer)
}

startApplication()
