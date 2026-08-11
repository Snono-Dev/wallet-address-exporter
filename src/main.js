import { createAppKit } from '@reown/appkit'
import {
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  avalanche,
  bsc,
  scroll,
  solana,
  bitcoin,
  bitcoinTestnet,
  bitcoinSignet,
  ton,
  tonTestnet,
  tronMainnet,
  tronShastaTestnet
} from '@reown/appkit/networks'

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin'
import { TonAdapter } from '@reown/appkit-adapter-ton'
import { TronAdapter } from '@reown/appkit-adapter-tron'
import { TronLinkAdapter } from '@tronweb3/tronwallet-adapter-tronlink'
import * as XLSX from 'xlsx'

import { PROJECT_ID, APP_URL } from './config'
import './style.css'

const $ = (id) => document.getElementById(id)

const connectButton = $('connectButton')
const exportButton = $('exportButton')
const clearButton = $('clearButton')
const status = $('status')
const table = $('addressTable')
const count = $('count')

const evmNetworks = [
  mainnet,
  arbitrum,
  base,
  polygon,
  optimism,
  avalanche,
  bsc,
  scroll
]

const networks = [
  ...evmNetworks,
  solana,
  bitcoin,
  bitcoinTestnet,
  bitcoinSignet,
  ton,
  tonTestnet,
  tronMainnet,
  tronShastaTestnet
]

const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: evmNetworks
})

const bitcoinAdapter = new BitcoinAdapter({ projectId: PROJECT_ID })
const solanaAdapter = new SolanaAdapter()
const tonAdapter = new TonAdapter({ projectId: PROJECT_ID })

const tronAdapter = new TronAdapter({
  walletAdapters: [
    new TronLinkAdapter({
      openUrlWhenWalletNotFound: false,
      checkTimeout: 3000
    })
  ]
})

const modal = createAppKit({
  adapters: [
    wagmiAdapter,
    solanaAdapter,
    bitcoinAdapter,
    tonAdapter,
    tronAdapter
  ],
  networks,
  projectId: PROJECT_ID,
  metadata: {
    name: 'Wallet Address Exporter',
    description: 'Export wallet accounts to Excel',
    url: APP_URL,
    icons: []
  },
  features: {
    analytics: false,
    email: false,
    socials: []
  }
})

let records = []

function setStatus(message) {
  status.textContent = message
}

function addRecord(record) {
  if (!record.address) return

  const normalized = {
    Currency: record.currency || 'Unknown',
    Network: record.network || 'Unknown',
    Address: String(record.address),
    Memo: record.memo ? String(record.memo) : ''
  }

  const duplicate = records.some((item) =>
    item.Currency === normalized.Currency &&
    item.Network === normalized.Network &&
    item.Address === normalized.Address &&
    item.Memo === normalized.Memo
  )

  if (!duplicate) {
    records.push(normalized)
    render()
  }
}

function currencyForEip155(chainId) {
  const id = Number(chainId)

  const map = {
    1: ['ETH', 'Ethereum'],
    10: ['ETH', 'Optimism'],
    56: ['BNB', 'BNB Smart Chain'],
    137: ['POL', 'Polygon'],
    42161: ['ETH', 'Arbitrum One'],
    8453: ['ETH', 'Base'],
    43114: ['AVAX', 'Avalanche'],
    534352: ['ETH', 'Scroll']
  }

  return map[id] || ['EVM', `EVM Network ${id || ''}`.trim()]
}

function parseAccount(account) {
  /*
   * CAIP-10 account format:
   * namespace:reference:address
   *
   * Example:
   * eip155:1:0xabc...
   * solana:mainnet:...
   * bip122:...:bc1...
   */
  if (typeof account !== 'string') return null

  const first = account.indexOf(':')
  const last = account.lastIndexOf(':')

  if (first <= 0 || last <= first) return null

  return {
    namespace: account.slice(0, first),
    reference: account.slice(first + 1, last),
    address: account.slice(last + 1)
  }
}

function addFromCaip10(account) {
  const parsed = parseAccount(account)
  if (!parsed) return

  if (parsed.namespace === 'eip155') {
    const [currency, network] = currencyForEip155(parsed.reference)
    addRecord({
      currency,
      network,
      address: parsed.address
    })
    return
  }

  if (parsed.namespace === 'solana') {
    addRecord({
      currency: 'SOL',
      network: parsed.reference === 'mainnet' ? 'Solana' : `Solana (${parsed.reference})`,
      address: parsed.address
    })
    return
  }

  if (parsed.namespace === 'bip122') {
    const btcMainnet = '000000000019d6689c085ae165831e934'
    const network = parsed.reference === btcMainnet
      ? 'Bitcoin'
      : 'Bitcoin (test/signet)'

    addRecord({
      currency: 'BTC',
      network,
      address: parsed.address
    })
    return
  }

  if (parsed.namespace === 'ton') {
    addRecord({
      currency: 'TON',
      network: parsed.reference.includes('test') ? 'TON Testnet' : 'TON',
      address: parsed.address
    })
    return
  }

  if (parsed.namespace === 'tron') {
    addRecord({
      currency: 'TRX',
      network: parsed.reference.includes('shasta') ? 'TRON Shasta Testnet' : 'TRON',
      address: parsed.address
    })
    return
  }

  addRecord({
    currency: parsed.namespace.toUpperCase(),
    network: parsed.reference,
    address: parsed.address
  })
}

function collectSessionAccounts() {
  /*
   * AppKit exposes the active wallet provider and provider type.
   * When the underlying WalletConnect provider exposes a session,
   * its namespaces contain CAIP-10 accounts.
   */
  const provider = modal.getWalletProvider()
  const providerType = modal.getWalletProviderType()

  console.debug('Provider type:', providerType)
  console.debug('Provider:', provider)

  const session =
    provider?.session ||
    provider?.signClient?.session ||
    provider?.client?.session ||
    null

  const namespaces = session?.namespaces || {}

  for (const namespace of Object.values(namespaces)) {
    for (const account of namespace.accounts || []) {
      addFromCaip10(account)
    }
  }

  /*
   * AppKit also gives us the currently active address.
   * We use it as a fallback if the provider does not expose
   * the full session namespace object.
   */
  const state = modal.getState()
  const selectedNetworkId = state?.selectedNetworkId

  if (modal.getIsConnected()) {
    const address =
      modal.getAddress?.() ||
      provider?.accounts?.[0] ||
      provider?.selectedAddress

    if (address) {
      if (typeof selectedNetworkId === 'number') {
        const [currency, network] = currencyForEip155(selectedNetworkId)
        addRecord({
          currency,
          network,
          address
        })
      } else {
        addRecord({
          currency: 'Unknown',
          network: providerType || 'Connected wallet',
          address
        })
      }
    }
  }
}

connectButton.addEventListener('click', async () => {
  if (PROJECT_ID === 'YOUR_REOWN_PROJECT_ID') {
    setStatus('ضع Reown Project ID أولًا في src/config.js')
    return
  }

  try {
    setStatus('جاري فتح نافذة الاتصال...')
    await modal.open({ view: 'Connect' })
  } catch (error) {
    console.error(error)
    setStatus(`تعذر فتح المحفظة: ${error?.message || error}`)
  }
})

modal.subscribeProvider(({ address, providerType, chainId, isConnected, error }) => {
  if (error) {
    console.error(error)
    setStatus(`خطأ في المحفظة: ${error?.message || error}`)
    return
  }

  if (!isConnected) {
    setStatus('غير متصل')
    return
  }

  if (address) {
    if (providerType === 'eip155' || providerType === 'EVM' || providerType === 'evm') {
      const [currency, network] = currencyForEip155(chainId)
      addRecord({ currency, network, address })
    } else if (providerType === 'solana') {
      addRecord({ currency: 'SOL', network: 'Solana', address })
    } else if (providerType === 'bip122') {
      addRecord({ currency: 'BTC', network: 'Bitcoin', address })
    } else if (providerType === 'ton') {
      addRecord({ currency: 'TON', network: 'TON', address })
    } else if (providerType === 'tron') {
      addRecord({ currency: 'TRX', network: 'TRON', address })
    } else {
      addRecord({ currency: 'Unknown', network: providerType || 'Unknown', address })
    }
  }

  /*
   * Give the WalletConnect/AppKit provider a moment to expose
   * its current session, then collect CAIP-10 accounts.
   */
  setTimeout(() => {
    collectSessionAccounts()
    setStatus(`متصل — ${records.length} عنوان`)
  }, 300)
})

function render() {
  count.textContent = records.length

  if (!records.length) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="empty">لم يتم العثور على عناوين بعد.</td>
      </tr>
    `
    exportButton.disabled = true
    return
  }

  table.innerHTML = records.map((item) => `
    <tr>
      <td>${escapeHtml(item.Currency)}</td>
      <td>${escapeHtml(item.Network)}</td>
      <td class="address">${escapeHtml(item.Address)}</td>
      <td>${escapeHtml(item.Memo)}</td>
    </tr>
  `).join('')

  exportButton.disabled = false
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

exportButton.addEventListener('click', () => {
  if (!records.length) return

  const worksheet = XLSX.utils.json_to_sheet(records)

  worksheet['!cols'] = [
    { wch: 15 },
    { wch: 28 },
    { wch: 65 },
    { wch: 30 }
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Wallet Addresses')

  XLSX.writeFile(workbook, 'wallet-addresses.xlsx')
})

clearButton.addEventListener('click', () => {
  records = []
  render()
  setStatus('تم مسح النتائج.')
})

render()
