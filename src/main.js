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
// ADD RECORD
// ============================================================

function addRecord(record) {

  if (!record) {
    return
  }


  if (!record.address) {
    return
  }


  const normalized = {

    Currency:
      record.currency ||
      'Unknown',

    Network:
      record.network ||
      'Unknown',

    Address:
      String(record.address),

    Memo:
      record.memo
        ? String(record.memo)
        : ''
  }


  const duplicate =
    records.some((item) => {

      return (

        item.Currency ===
          normalized.Currency &&

        item.Network ===
          normalized.Network &&

        item.Address ===
          normalized.Address &&

        item.Memo ===
          normalized.Memo

      )

    })


  if (!duplicate) {

    records.push(normalized)

    render()

  }

}


// ============================================================
// EVM NETWORK INFORMATION
// ============================================================

function currencyForEip155(chainId) {

  const id = Number(chainId)


  const map = {

    1: [
      'ETH',
      'Ethereum'
    ],

    10: [
      'ETH',
      'Optimism'
    ],

    56: [
      'BNB',
      'BNB Smart Chain'
    ],

    137: [
      'POL',
      'Polygon'
    ],

    42161: [
      'ETH',
      'Arbitrum One'
    ],

    8453: [
      'ETH',
      'Base'
    ],

    43114: [
      'AVAX',
      'Avalanche'
    ],

    534352: [
      'ETH',
      'Scroll'
    ]

  }


  return (

    map[id] ||

    [
      'EVM',
      `EVM Network ${id || ''}`.trim()
    ]

  )

}


// ============================================================
// CAIP-10 PARSER
// ============================================================

function parseAccount(account) {

  if (
    typeof account !==
    'string'
  ) {

    return null

  }


  const first =
    account.indexOf(':')


  const last =
    account.lastIndexOf(':')


  if (
    first <= 0 ||
    last <= first
  ) {

    return null

  }


  return {

    namespace:
      account.slice(
        0,
        first
      ),

    reference:
      account.slice(
        first + 1,
        last
      ),

    address:
      account.slice(
        last + 1
      )

  }

}


// ============================================================
// CAIP-10 ACCOUNT → RECORD
// ============================================================

function addFromCaip10(account) {

  const parsed =
    parseAccount(account)


  if (!parsed) {
    return
  }


  // ==========================================================
  // EVM
  // ==========================================================

  if (
    parsed.namespace ===
    'eip155'
  ) {

    const [
      currency,
      network
    ] =
      currencyForEip155(
        parsed.reference
      )


    addRecord({

      currency,

      network,

      address:
        parsed.address

    })


    return
  }


  // ==========================================================
  // SOLANA
  // ==========================================================

  if (
    parsed.namespace ===
    'solana'
  ) {

    addRecord({

      currency:
        'SOL',

      network:
        parsed.reference ===
        'mainnet'

          ? 'Solana'

          : `Solana (${parsed.reference})`,

      address:
        parsed.address

    })


    return
  }


  // ==========================================================
  // BITCOIN
  // ==========================================================

  if (
    parsed.namespace ===
    'bip122'
  ) {

    const bitcoinMainnet =
      '000000000019d6689c085ae165831e93'


    const network =
      parsed.reference ===
      bitcoinMainnet

        ? 'Bitcoin'

        : 'Bitcoin Testnet / Signet'


    addRecord({

      currency:
        'BTC',

      network,

      address:
        parsed.address

    })


    return
  }


  // ==========================================================
  // TON
  // ==========================================================

  if (
    parsed.namespace ===
    'ton'
  ) {

    addRecord({

      currency:
        'TON',

      network:
        parsed.reference
          .toLowerCase()
          .includes('test')

          ? 'TON Testnet'

          : 'TON',

      address:
        parsed.address

    })


    return
  }


  // ==========================================================
  // TRON
  // ==========================================================

  if (
    parsed.namespace ===
    'tron'
  ) {

    addRecord({

      currency:
        'TRX',

      network:
        parsed.reference
          .toLowerCase()
          .includes('shasta')

          ? 'TRON Shasta Testnet'

          : 'TRON',

      address:
        parsed.address

    })


    return
  }


  // ==========================================================
  // UNKNOWN NAMESPACE
  // ==========================================================

  addRecord({

    currency:
      parsed.namespace.toUpperCase(),

    network:
      parsed.reference,

    address:
      parsed.address

  })

}


// ============================================================
// TRY TO EXTRACT SESSION ACCOUNTS
// ============================================================

function collectSessionAccounts() {

  try {

    console.debug(
      '[WalletExporter] Collecting accounts...'
    )


    // --------------------------------------------------------
    // Wallet provider
    // --------------------------------------------------------

    const provider =
      modal.getWalletProvider?.()


    console.debug(
      '[WalletExporter] Provider:',
      provider
    )


    // --------------------------------------------------------
    // Provider type
    // --------------------------------------------------------

    const providerType =
      modal.getWalletProviderType?.()


    console.debug(
      '[WalletExporter] Provider type:',
      providerType
    )


    // --------------------------------------------------------
    // Try to find WalletConnect session
    // --------------------------------------------------------

    const session =
      provider?.session ||

      provider?.signClient
        ?.session ||

      provider?.client
        ?.session ||

      null


    console.debug(
      '[WalletExporter] Session:',
      session
    )


    const namespaces =
      session?.namespaces ||
      {}


    console.debug(
      '[WalletExporter] Namespaces:',
      namespaces
    )


    // --------------------------------------------------------
    // Extract CAIP-10 accounts
    // --------------------------------------------------------

    for (
      const namespace
      of Object.values(namespaces)
    ) {

      const accounts =
        namespace?.accounts ||
        []


      for (
        const account
        of accounts
      ) {

        console.debug(
          '[WalletExporter] Account:',
          account
        )


        addFromCaip10(
          account
        )

      }

    }


    // --------------------------------------------------------
    // Fallback to AppKit
    // --------------------------------------------------------

    if (
      modal.getIsConnected?.()
    ) {

      const address =
        modal.getAddress?.()


      const chainId =
        modal.getChainId?.()


      console.debug(
        '[WalletExporter] AppKit address:',
        address
      )


      console.debug(
        '[WalletExporter] AppKit chain:',
        chainId
      )


      if (address) {

        if (
          typeof chainId ===
          'number' ||
          typeof chainId ===
          'string'
        ) {

          const [
            currency,
            network
          ] =
            currencyForEip155(
              chainId
            )


          addRecord({

            currency,

            network,

            address

          })

        } else {

          addRecord({

            currency:
              'Unknown',

            network:
              providerType ||
              'Connected Wallet',

            address

          })

        }

      }

    }


    console.debug(
      '[WalletExporter] Records:',
      records
    )


  } catch (error) {

    console.error(
      '[WalletExporter] Error collecting accounts:',
      error
    )

  }

}


// ============================================================
// CONNECT BUTTON
// ============================================================

if (connectButton) {

  connectButton.addEventListener(
    'click',
    async () => {

      try {

        setStatus(
          'فتح WalletConnect...'
        )


        console.debug(
          '[WalletExporter] Opening AppKit...'
        )


        await modal.open({

          view:
            'Connect'

        })


        console.debug(
          '[WalletExporter] AppKit opened'
        )


        /*
         * مهم:
         *
         * modal.open()
         * لا يعني أن المحفظة اتصلت.
         *
         * هو فقط يفتح واجهة الاتصال.
         *
         * نجاح الاتصال يتم التقاطه
         * عن طريق AppKit events/state.
         */

      } catch (error) {

        console.error(
          '[WalletExporter] Failed to open AppKit:',
          error
        )


        setStatus(

          `خطأ في فتح WalletConnect: ${
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
        '[WalletExporter] AppKit state:',
        state
      )


      const connected =
        modal.getIsConnected?.() === true


      // ------------------------------------------------------
      // CONNECTED
      // ------------------------------------------------------

      if (connected) {

        wasConnected =
          true


        setStatus(
          'تم الاتصال — جاري قراءة الحساب...'
        )


        setTimeout(
          () => {

            collectSessionAccounts()


            setStatus(

              `متصل — ${
                records.length
              } عنوان`

            )

          },
          500
        )


        return

      }


      // ------------------------------------------------------
      // DISCONNECTED AFTER CONNECTION
      // ------------------------------------------------------

      if (wasConnected) {

        setStatus(
          'غير متصل'
        )

        return

      }


      // ------------------------------------------------------
      // INITIAL STATE
      // ------------------------------------------------------

      console.debug(
        '[WalletExporter] Waiting for wallet connection...'
      )

    }
  )

} else {

  console.warn(
    '[WalletExporter] subscribeState is not available'
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
        '[WalletExporter] AppKit event:',
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
      // SUCCESSFUL CONNECTION
      // ------------------------------------------------------

      if (
        eventType ===
          'CONNECT_SUCCESS' ||

        eventType ===
          'CONNECT'
      ) {

        wasConnected =
          true


        setStatus(
          'تم الاتصال — جاري قراءة الحساب...'
        )


        setTimeout(
          () => {

            collectSessionAccounts()


            setStatus(

              `متصل — ${
                records.length
              } عنوان`

            )

          },
          700
        )

      }


      // ------------------------------------------------------
      // DISCONNECT
      // ------------------------------------------------------

      if (
        eventType ===
          'DISCONNECT_SUCCESS' ||

        eventType ===
          'DISCONNECT'
      ) {

        wasConnected =
          false


        setStatus(
          'غير متصل'
        )

      }

    }
  )

} else {

  console.warn(
    '[WalletExporter] subscribeEvents is not available'
  )

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      '&',
      '&amp;'
    )

    .replaceAll(
      '<',
      '&lt;'
    )

    .replaceAll(
      '>',
      '&gt;'
    )

    .replaceAll(
      '"',
      '&quot;'
    )

    .replaceAll(
      "'",
      '&#039;'
    )

}


// ============================================================
// RENDER TABLE
// ============================================================

function render() {

  // ----------------------------------------------------------
  // Count
  // ----------------------------------------------------------

  if (count) {

    count.textContent =
      records.length

  }


  // ----------------------------------------------------------
  // Table
  // ----------------------------------------------------------

  if (!table) {
    return
  }


  // ----------------------------------------------------------
  // Empty
  // ----------------------------------------------------------

  if (
    records.length ===
    0
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


  // ----------------------------------------------------------
  // Rows
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Enable export
  // ----------------------------------------------------------

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
        records.length ===
        0
      ) {

        return

      }


      const worksheet =
        XLSX.utils.json_to_sheet(
          records
        )


      // ------------------------------------------------------
      // Column widths
      // ------------------------------------------------------

      worksheet['!cols'] = [

        {
          wch: 15
        },

        {
          wch: 30
        },

        {
          wch: 70
        },

        {
          wch: 30
        }

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
// INITIAL RENDER
// ============================================================

render()


setStatus(
  'جاهز للاتصال بالمحفظة'
)


// ============================================================
// DEBUG
// ============================================================

console.debug(
  '[WalletExporter] Application initialized'
)

console.debug(
  '[WalletExporter] AppKit:',
  modal
)