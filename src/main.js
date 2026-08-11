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
  solana,
  bitcoin,
  bitcoinTestnet,
  bitcoinSignet,
  ton,
  tonTestnet,
  tronMainnet,
  tronShastaTestnet
]


// ============================================================
// ADAPTERS
// ============================================================

const wagmiAdapter = new WagmiAdapter({
  projectId: PROJECT_ID,
  networks: evmNetworks
})

const bitcoinAdapter = new BitcoinAdapter({
  projectId: PROJECT_ID
})

const solanaAdapter = new SolanaAdapter()

const tonAdapter = new TonAdapter({
  projectId: PROJECT_ID
})

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

    description:
      'Export wallet addresses and account information to Excel',

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

let wasConnected = false


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {
  if (status) {
    status.textContent = message
  }
}


// ============================================================
// EVM NETWORK
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
// ADD RECORD
// ============================================================

function addRecord({
  currency = 'Unknown',
  network = 'Unknown',
  address,
  memo = ''
}) {

  if (!address) {
    return
  }

  const record = {
    Currency: String(currency),
    Network: String(network),
    Address: String(address),
    Memo: memo ? String(memo) : ''
  }

  const exists = records.some((item) =>
    item.Currency === record.Currency &&
    item.Network === record.Network &&
    item.Address === record.Address &&
    item.Memo === record.Memo
  )

  if (!exists) {
    records.push(record)
    render()
  }
}


// ============================================================
// CAIP-10 PARSER
// ============================================================

function parseCaip10(account) {

  if (typeof account !== 'string') {
    return null
  }

  const first = account.indexOf(':')
  const last = account.lastIndexOf(':')

  if (
    first <= 0 ||
    last <= first
  ) {
    return null
  }

  return {
    namespace: account.slice(0, first),
    reference: account.slice(first + 1, last),
    address: account.slice(last + 1)
  }
}


// ============================================================
// CAIP-10 → RECORD
// ============================================================

function addCaip10Account(account) {

  const parsed = parseCaip10(account)

  if (!parsed) {
    return
  }

  // ----------------------------------------------------------
  // EVM
  // ----------------------------------------------------------

  if (parsed.namespace === 'eip155') {

    const [
      currency,
      network
    ] = currencyForEip155(parsed.reference)

    addRecord({
      currency,
      network,
      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // Solana
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
  // Bitcoin
  // ----------------------------------------------------------

  if (parsed.namespace === 'bip122') {

    const bitcoinMainnet =
      '000000000019d6689c085ae165831e93'

    addRecord({
      currency: 'BTC',

      network:
        parsed.reference === bitcoinMainnet
          ? 'Bitcoin'
          : 'Bitcoin Testnet / Signet',

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
        parsed.reference.toLowerCase().includes('test')
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
        parsed.reference.toLowerCase().includes('shasta')
          ? 'TRON Shasta Testnet'
          : 'TRON',

      address: parsed.address
    })

    return
  }


  // ----------------------------------------------------------
  // Unknown CAIP namespace
  // ----------------------------------------------------------

  addRecord({
    currency: parsed.namespace.toUpperCase(),
    network: parsed.reference,
    address: parsed.address
  })
}


// ============================================================
// GENERIC ACCOUNT EXTRACTION
// ============================================================

function extractAccountsFromObject(value) {

  if (!value) {
    return
  }


  // String containing CAIP-10 account

  if (typeof value === 'string') {

    if (
      value.includes(':') &&
      value.split(':').length >= 3
    ) {
      addCaip10Account(value)
    }

    return
  }


  // Array

  if (Array.isArray(value)) {

    for (const item of value) {
      extractAccountsFromObject(item)
    }

    return
  }


  // Object

  if (
    typeof value === 'object'
  ) {

    // Common account fields

    const accountFields = [
      'accounts',
      'account',
      'address',
      'addresses'
    ]

    for (
      const field
      of accountFields
    ) {

      if (
        value[field] !== undefined
      ) {

        extractAccountsFromObject(
          value[field]
        )

      }

    }


    // CAIP namespaces

    if (value.namespaces) {

      for (
        const namespace
        of Object.values(
          value.namespaces
        )
      ) {

        extractAccountsFromObject(
          namespace
        )

      }

    }


    // Namespace-specific objects

    for (
      const [key, child]
      of Object.entries(value)
    ) {

      if (
        key === 'namespaces' ||
        accountFields.includes(key)
      ) {
        continue
      }

      /*
       * Don't recursively scan every object blindly.
       * Only inspect objects that look like account/session data.
       */

      if (
        key === 'session' ||
        key === 'connection' ||
        key === 'data' ||
        key === 'result'
      ) {

        extractAccountsFromObject(
          child
        )

      }

    }

  }

}


// ============================================================
// GET APPKIT ACCOUNT DATA
// ============================================================

function collectAccounts() {

  console.group(
    '[WalletExporter] Collecting accounts'
  )


  try {

    // --------------------------------------------------------
    // 1. AppKit state
    // --------------------------------------------------------

    const state =
      typeof modal.getState === 'function'
        ? modal.getState()
        : null

    console.debug(
      'AppKit state:',
      state
    )


    // Search state for account data

    extractAccountsFromObject(
      state
    )


    // --------------------------------------------------------
    // 2. AppKit address
    // --------------------------------------------------------

    const address =
      typeof modal.getAddress === 'function'
        ? modal.getAddress()
        : null

    const chainId =
      typeof modal.getChainId === 'function'
        ? modal.getChainId()
        : null


    console.debug(
      'AppKit address:',
      address
    )

    console.debug(
      'AppKit chainId:',
      chainId
    )


    if (address) {

      if (chainId !== null && chainId !== undefined) {

        const [
          currency,
          network
        ] = currencyForEip155(
          chainId
        )

        addRecord({
          currency,
          network,
          address
        })

      } else {

        addRecord({
          currency: 'Unknown',
          network: 'Connected Wallet',
          address
        })

      }

    }


    // --------------------------------------------------------
    // 3. Wallet provider
    // --------------------------------------------------------

    const provider =
      typeof modal.getWalletProvider === 'function'
        ? modal.getWalletProvider()
        : null


    console.debug(
      'Wallet provider:',
      provider
    )


    if (provider) {

      // Direct provider account fields

      extractAccountsFromObject(
        provider.accounts
      )

      extractAccountsFromObject(
        provider.selectedAddress
      )


      // WalletConnect session

      extractAccountsFromObject(
        provider.session
      )


      extractAccountsFromObject(
        provider.signClient?.session
      )


      extractAccountsFromObject(
        provider.client?.session
      )

    }


    // --------------------------------------------------------
    // 4. Wallet provider type
    // --------------------------------------------------------

    const providerType =
      typeof modal.getWalletProviderType === 'function'
        ? modal.getWalletProviderType()
        : null


    console.debug(
      'Wallet provider type:',
      providerType
    )


    console.debug(
      'Final records:',
      records
    )


  } catch (error) {

    console.error(
      '[WalletExporter] Account collection failed:',
      error
    )

  }


  console.groupEnd()

}


// ============================================================
// CONNECT
// ============================================================

if (connectButton) {

  connectButton.addEventListener(
    'click',
    async () => {

      try {

        setStatus(
          'فتح WalletConnect...'
        )

        console.log(
          '[WalletExporter] Opening AppKit'
        )


        await modal.open({
          view: 'Connect'
        })


        console.log(
          '[WalletExporter] AppKit opened'
        )


      } catch (error) {

        console.error(
          '[WalletExporter] Open error:',
          error
        )


        setStatus(
          `خطأ: ${
            error?.message ||
            String(error)
          }`
        )

      }

    }
  )

}


// ============================================================
// APPKIT STATE
// ============================================================

if (
  typeof modal.subscribeState ===
  'function'
) {

  modal.subscribeState(
    (state) => {

      console.debug(
        '[WalletExporter] State changed:',
        state
      )


      const connected =
        modal.getIsConnected?.() === true


      if (connected) {

        wasConnected = true


        setStatus(
          'تم الاتصال — جاري قراءة الحسابات...'
        )


        /*
         * Give AppKit a moment to synchronize
         * the selected account.
         */

        setTimeout(
          () => {

            collectAccounts()


            if (
              records.length > 0
            ) {

              setStatus(
                `متصل — ${records.length} عنوان`
              )

            } else {

              setStatus(
                'تم الاتصال — لم يتم العثور على عنوان'
              )

            }

          },
          800
        )


        return
      }


      if (wasConnected) {

        setStatus(
          'غير متصل'
        )

      }

    }
  )

}


// ============================================================
// APPKIT EVENTS
// ============================================================

if (
  typeof modal.subscribeEvents ===
  'function'
) {

  modal.subscribeEvents(
    (event) => {

      console.debug(
        '[WalletExporter] Event:',
        event
      )


      const eventType =
        event?.data?.event ||
        event?.event ||
        event?.type


      console.debug(
        '[WalletExporter] Event type:',
        eventType
      )


      // ------------------------------------------------------
      // Connect
      // ------------------------------------------------------

      if (
        eventType === 'CONNECT_SUCCESS' ||
        eventType === 'CONNECT'
      ) {

        wasConnected = true


        setStatus(
          'تم الاتصال — جاري قراءة الحسابات...'
        )


        setTimeout(
          () => {

            collectAccounts()


            if (
              records.length > 0
            ) {

              setStatus(
                `متصل — ${records.length} عنوان`
              )

            } else {

              setStatus(
                'تم الاتصال — لم يتم العثور على عنوان'
              )

            }

          },
          1000
        )

      }


      // ------------------------------------------------------
      // Disconnect
      // ------------------------------------------------------

      if (
        eventType === 'DISCONNECT_SUCCESS' ||
        eventType === 'DISCONNECT'
      ) {

        wasConnected = false

        setStatus(
          'غير متصل'
        )

      }

    }
  )

}


// ============================================================
// HTML ESCAPE
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
// RENDER
// ============================================================

function render() {

  if (count) {

    count.textContent =
      records.length

  }


  if (!table) {
    return
  }


  if (
    records.length === 0
  ) {

    table.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="empty"
        >
          لم يتم العثور على عناوين بعد.
        </td>
      </tr>
    `


    if (exportButton) {

      exportButton.disabled =
        true

    }

    return

  }


  table.innerHTML =
    records
      .map(
        (item) => `
          <tr>

            <td>
              ${escapeHtml(
                item.Currency
              )}
            </td>

            <td>
              ${escapeHtml(
                item.Network
              )}
            </td>

            <td class="address">
              ${escapeHtml(
                item.Address
              )}
            </td>

            <td>
              ${escapeHtml(
                item.Memo
              )}
            </td>

          </tr>
        `
      )
      .join('')


  if (exportButton) {

    exportButton.disabled =
      false

  }

}


// ============================================================
// EXPORT EXCEL
// ============================================================

if (exportButton) {

  exportButton.addEventListener(
    'click',
    () => {

      if (
        records.length === 0
      ) {
        return
      }


      const worksheet =
        XLSX.utils.json_to_sheet(
          records
        )


      worksheet['!cols'] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 70 },
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

}


// ============================================================
// CLEAR
// ============================================================

if (clearButton) {

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

}


// ============================================================
// INITIALIZE
// ============================================================

render()

setStatus(
  'جاهز للاتصال بالمحفظة'
)


console.log(
  '[WalletExporter] Initialized'
)