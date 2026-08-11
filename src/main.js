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


// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id)

const connectButton = $('connectButton')
const exportButton = $('exportButton')
const clearButton = $('clearButton')
const status = $('status')
const table = $('addressTable')
const count = $('count')


// ============================================================
// NETWORKS
// ============================================================

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

  // Solana
  solana,

  // Bitcoin
  bitcoin,
  bitcoinTestnet,
  bitcoinSignet,

  // TON
  ton,
  tonTestnet,

  // TRON
  tronMainnet,
  tronShastaTestnet
]


// ============================================================
// ADAPTERS
// ============================================================

// EVM
const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: evmNetworks
})


// Bitcoin
const bitcoinAdapter = new BitcoinAdapter({
  projectId: PROJECT_ID
})


// Solana
const solanaAdapter = new SolanaAdapter()


// TON
const tonAdapter = new TonAdapter({
  projectId: PROJECT_ID
})


// TRON
const tronAdapter = new TronAdapter({
  walletAdapters: [
    new TronLinkAdapter({
      openUrlWhenWalletNotFound: false,
      checkTimeout: 3000
    })
  ]
})


// ============================================================
// APPKIT
// ============================================================

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

    // Must match the deployed website origin/path
    url: APP_URL,

    icons: []
  },

  features: {
    analytics: false,
    email: false,
    socials: []
  }
})


// ============================================================
// DATA
// ============================================================

let records = []


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {
  status.textContent = message
}


// ============================================================
// ADD RECORD
// ============================================================

function addRecord(record) {
  if (!record || !record.address) return

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


// ============================================================
// EVM NETWORK → CURRENCY
// ============================================================

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

  return map[id] || [
    'EVM',
    `EVM Network ${id || ''}`.trim()
  ]
}


// ============================================================
// PARSE CAIP-10
// ============================================================

function parseAccount(account) {
  /*
   * CAIP-10:
   *
   * namespace:reference:address
   *
   * Examples:
   *
   * eip155:1:0xabc...
   * solana:mainnet:ABC...
   * bip122:...:bc1...
   * ton:mainnet:EQ...
   * tron:0x2b6653dc:TX...
   */

  if (typeof account !== 'string') {
    return null
  }

  const first = account.indexOf(':')
  const last = account.lastIndexOf(':')

  if (first <= 0 || last <= first) {
    return null
  }

  return {
    namespace: account.slice(0, first),
    reference: account.slice(first + 1, last),
    address: account.slice(last + 1)
  }
}


// ============================================================
// ADD CAIP-10 ACCOUNT
// ============================================================

function addFromCaip10(account) {
  const parsed = parseAccount(account)

  if (!parsed) return


  // ----------------------------------------------------------
  // EVM
  // ----------------------------------------------------------

  if (parsed.namespace === 'eip155') {
    const [currency, network] =
      currencyForEip155(parsed.reference)

    addRecord({
      currency,
      network,
      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // SOLANA
  // ----------------------------------------------------------

  if (parsed.namespace === 'solana') {
    addRecord({
      currency: 'SOL',

      network:
        parsed.reference === 'mainnet'
          ? 'Solana'
          : `Solana (${parsed.reference})`,

      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // BITCOIN
  // ----------------------------------------------------------

  if (parsed.namespace === 'bip122') {
    const bitcoinMainnetGenesis =
      '000000000019d6689c085ae165831e934'

    const network =
      parsed.reference === bitcoinMainnetGenesis
        ? 'Bitcoin'
        : 'Bitcoin (test/signet)'

    addRecord({
      currency: 'BTC',
      network,
      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // TON
  // ----------------------------------------------------------

  if (parsed.namespace === 'ton') {
    addRecord({
      currency: 'TON',

      network:
        parsed.reference.includes('test')
          ? 'TON Testnet'
          : 'TON',

      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // TRON
  // ----------------------------------------------------------

  if (parsed.namespace === 'tron') {
    addRecord({
      currency: 'TRX',

      network:
        parsed.reference.includes('shasta')
          ? 'TRON Shasta Testnet'
          : 'TRON',

      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // UNKNOWN NAMESPACE
  // ----------------------------------------------------------

  addRecord({
    currency: parsed.namespace.toUpperCase(),
    network: parsed.reference,
    address: parsed.address
  })
}


// ============================================================
// COLLECT SESSION ACCOUNTS
// ============================================================

function collectSessionAccounts() {
  try {
    const provider = modal.getWalletProvider?.()
    const providerType = modal.getWalletProviderType?.()

    console.debug(
      'Provider type:',
      providerType
    )

    console.debug(
      'Provider:',
      provider
    )


    /*
     * Some WalletConnect providers expose their
     * active session through one of these objects.
     *
     * This is intentionally treated as optional.
     */

    const session =
      provider?.session ||
      provider?.signClient?.session ||
      provider?.client?.session ||
      null


    const namespaces =
      session?.namespaces || {}


    /*
     * Read all CAIP-10 accounts exposed by the session.
     */

    for (const namespace of Object.values(namespaces)) {
      const accounts = namespace?.accounts || []

      for (const account of accounts) {
        addFromCaip10(account)
      }
    }


    /*
     * Fallback:
     *
     * AppKit exposes the currently active address.
     */

    if (modal.getIsConnected?.()) {
      const address =
        modal.getAddress?.() ||
        provider?.accounts?.[0] ||
        provider?.selectedAddress

      if (address) {
        const chainId =
          modal.getChainId?.() ||
          modal.getState?.()?.selectedNetworkId

        if (typeof chainId === 'number') {
          const [currency, network] =
            currencyForEip155(chainId)

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

  } catch (error) {
    console.error(
      'Error collecting wallet accounts:',
      error
    )
  }
}


// ============================================================
// CONNECT BUTTON
// ============================================================

connectButton.addEventListener(
  'click',
  async () => {

    if (
      !PROJECT_ID ||
      PROJECT_ID === 'YOUR_REOWN_PROJECT_ID'
    ) {
      setStatus(
        'ضع Reown Project ID أولًا في src/config.js'
      )

      return
    }


    try {

      setStatus(
        'جاري فتح نافذة الاتصال...'
      )


      /*
       * Open AppKit connection modal.
       */

      await modal.open({
        view: 'Connect'
      })

    } catch (error) {

      console.error(
        'Failed to open AppKit:',
        error
      )

      setStatus(
        `تعذر فتح المحفظة: ${
          error?.message || error
        }`
      )
    }
  }
)


// ============================================================
// APPKIT STATE
// ============================================================

/*
 * IMPORTANT:
 *
 * We intentionally use subscribeState instead of
 * subscribeProvider here.
 *
 * This prevents our application code from depending
 * directly on the provider subscription API.
 */

if (typeof modal.subscribeState === 'function') {

  modal.subscribeState((state) => {

    console.debug(
      'AppKit state:',
      state
    )


    /*
     * If the modal is closed, don't change
     * connection status unnecessarily.
     */

    if (!modal.getIsConnected?.()) {
      setStatus('غير متصل')
      return
    }


    /*
     * Give the adapter a short moment to expose
     * the connected account/session.
     */

    setTimeout(() => {

      collectSessionAccounts()

      setStatus(
        `متصل — ${records.length} عنوان`
      )

    }, 300)
  })

} else {

  console.warn(
    'AppKit subscribeState is not available'
  )
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}


// ============================================================
// RENDER TABLE
// ============================================================

function render() {

  count.textContent = records.length


  if (!records.length) {

    table.innerHTML = `
      <tr>
        <td colspan="4" class="empty">
          لم يتم العثور على عناوين بعد.
        </td>
      </tr>
    `

    exportButton.disabled = true

    return
  }


  table.innerHTML = records
    .map((item) => `
      <tr>
        <td>
          ${escapeHtml(item.Currency)}
        </td>

        <td>
          ${escapeHtml(item.Network)}
        </td>

        <td class="address">
          ${escapeHtml(item.Address)}
        </td>

        <td>
          ${escapeHtml(item.Memo)}
        </td>
      </tr>
    `)
    .join('')


  exportButton.disabled = false
}


// ============================================================
// EXPORT EXCEL
// ============================================================

exportButton.addEventListener(
  'click',
  () => {

    if (!records.length) {
      return
    }


    const worksheet =
      XLSX.utils.json_to_sheet(records)


    worksheet['!cols'] = [
      { wch: 15 },
      { wch: 28 },
      { wch: 65 },
      { wch: 30 }
    ]


    const workbook =
      XLSX.utils.book_new()


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Wallet Addresses'
    )


    XLSX.writeFile(
      workbook,
      'wallet-addresses.xlsx'
    )
  }
)


// ============================================================
// CLEAR
// ============================================================

clearButton.addEventListener(
  'click',
  () => {

    records = []

    render()

    setStatus(
      'تم مسح النتائج.'
    )
  }
)


// ============================================================
// INITIAL RENDER
// ============================================================

render()