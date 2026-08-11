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

import {
  PROJECT_ID,
  APP_URL
} from './config'

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
      'Export wallet accounts to Excel',

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

let rawAccounts = []

let lastSession = null

let wasConnected = false

let collectionInProgress = false


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {

  if (status) {
    status.textContent = message
  }

}


// ============================================================
// CLEAN STRING
// ============================================================

function cleanString(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  return String(value).trim()

}


// ============================================================
// NETWORK MAP
// ============================================================

const EVM_NETWORKS = {

  1: {
    currency: 'ETH',
    network: 'Ethereum'
  },

  10: {
    currency: 'ETH',
    network: 'Optimism'
  },

  56: {
    currency: 'BNB',
    network: 'BNB Smart Chain'
  },

  137: {
    currency: 'POL',
    network: 'Polygon'
  },

  42161: {
    currency: 'ETH',
    network: 'Arbitrum One'
  },

  8453: {
    currency: 'ETH',
    network: 'Base'
  },

  43114: {
    currency: 'AVAX',
    network: 'Avalanche'
  },

  534352: {
    currency: 'ETH',
    network: 'Scroll'
  }

}


// ============================================================
// NETWORK INFO
// ============================================================

function getNetworkInfo(
  namespace,
  reference
) {

  const ns =
    cleanString(namespace)
      .toLowerCase()

  const ref =
    cleanString(reference)


  // EVM

  if (ns === 'eip155') {

    const info =
      EVM_NETWORKS[
        Number(ref)
      ]

    if (info) {
      return info
    }

    return {

      currency: 'EVM',

      network:
        `EVM Network ${ref}`

    }

  }


  // Solana

  if (ns === 'solana') {

    const lower =
      ref.toLowerCase()

    return {

      currency: 'SOL',

      network:
        lower.includes('test')
          ? 'Solana Testnet'
          : lower.includes('devnet')
            ? 'Solana Devnet'
            : 'Solana'

    }

  }


  // Bitcoin

  if (ns === 'bip122') {

    const bitcoinMainnet =
      '000000000019d6689c085ae165831e93'

    return {

      currency: 'BTC',

      network:
        ref === bitcoinMainnet
          ? 'Bitcoin'
          : 'Bitcoin Testnet / Signet'

    }

  }


  // TON

  if (ns === 'ton') {

    const lower =
      ref.toLowerCase()

    return {

      currency: 'TON',

      network:
        lower.includes('test')
          ? 'TON Testnet'
          : 'TON'

    }

  }


  // TRON

  if (ns === 'tron') {

    const lower =
      ref.toLowerCase()

    return {

      currency: 'TRX',

      network:
        lower.includes('shasta')
          ? 'TRON Shasta Testnet'
          : 'TRON'

    }

  }


  // Unknown namespace

  return {

    currency:
      ns
        ? ns.toUpperCase()
        : 'Unknown',

    network:
      ref || 'Unknown'

  }

}


// ============================================================
// CAIP-10 PARSER
// ============================================================

function parseCaip10(account) {

  if (
    typeof account !== 'string'
  ) {
    return null
  }

  const value =
    account.trim()

  const firstColon =
    value.indexOf(':')

  const lastColon =
    value.lastIndexOf(':')

  if (
    firstColon <= 0 ||
    lastColon <= firstColon
  ) {
    return null
  }

  const namespace =
    value.slice(
      0,
      firstColon
    )

  const reference =
    value.slice(
      firstColon + 1,
      lastColon
    )

  const address =
    value.slice(
      lastColon + 1
    )

  if (!address) {
    return null
  }

  return {

    namespace,

    reference,

    address,

    caip10: value

  }

}


// ============================================================
// MEMO SEARCH
// ============================================================

function findMemo(object) {

  if (!object) {
    return ''
  }

  if (
    typeof object !== 'object'
  ) {
    return ''
  }

  const fields = [

    'memo',

    'tag',

    'destinationTag',

    'destination_tag',

    'paymentId',

    'payment_id',

    'comment',

    'note'

  ]

  for (
    const field of fields
  ) {

    if (
      object[field] !==
        undefined &&
      object[field] !==
        null
    ) {

      const value =
        cleanString(
          object[field]
        )

      if (value) {
        return value
      }

    }

  }

  return ''

}


// ============================================================
// ADD RAW ACCOUNT
// ============================================================

function addRawAccount(

  account,

  memo = ''

) {

  if (
    typeof account !== 'string'
  ) {
    return
  }

  const value =
    account.trim()

  if (!value) {
    return
  }

  /*
   * This is intentionally separate
   * from the converted records.
   *
   * rawAccounts contains EXACTLY
   * what was received in accounts[].
   */

  if (
    !rawAccounts.includes(value)
  ) {

    rawAccounts.push(value)

  }


  const parsed =
    parseCaip10(value)

  if (!parsed) {

    console.warn(
      '[WalletExporter] Invalid account:',
      value
    )

    return

  }


  const info =
    getNetworkInfo(
      parsed.namespace,
      parsed.reference
    )


  addRecord({

    currency:
      info.currency,

    network:
      info.network,

    address:
      parsed.address,

    memo

  })

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

  const finalAddress =
    cleanString(address)

  if (!finalAddress) {
    return false
  }


  const record = {

    Currency:
      cleanString(currency) ||
      'Unknown',

    Network:
      cleanString(network) ||
      'Unknown',

    Address:
      finalAddress,

    Memo:
      cleanString(memo)

  }


  const exists =
    records.some(
      (item) =>

        item.Currency ===
          record.Currency &&

        item.Network ===
          record.Network &&

        item.Address ===
          record.Address &&

        item.Memo ===
          record.Memo
    )


  if (exists) {
    return false
  }


  records.push(record)

  render()

  return true

}


// ============================================================
// EXTRACT NAMESPACE
// ============================================================

function extractNamespace(

  namespaceName,

  namespaceData

) {

  if (!namespaceData) {
    return
  }


  const namespace =
    cleanString(
      namespaceName
    )


  const accounts =
    Array.isArray(
      namespaceData.accounts
    )
      ? namespaceData.accounts
      : []


  const chains =
    Array.isArray(
      namespaceData.chains
    )
      ? namespaceData.chains
      : []


  const namespaceMemo =
    findMemo(
      namespaceData
    )


  console.group(
    `[WalletExporter] Namespace: ${namespace}`
  )


  console.log(
    'accounts[]:',
    accounts
  )


  console.log(
    'chains[]:',
    chains
  )


  // ----------------------------------------------------------
  // EXACT accounts[] VALUES
  // ----------------------------------------------------------

  for (
    const account of accounts
  ) {

    if (
      typeof account === 'string'
    ) {

      addRawAccount(
        account,
        namespaceMemo
      )

    }

  }


  console.groupEnd()

}


// ============================================================
// EXTRACT SESSION
// ============================================================

function extractSession(
  session,
  source = 'unknown'
) {

  if (!session) {
    return
  }


  console.group(
    `[WalletExporter] SESSION SOURCE: ${source}`
  )


  console.log(
    'FULL SESSION:',
    session
  )


  lastSession =
    session


  const namespaces =
    session.namespaces ||
    {}


  console.log(
    'SESSION NAMESPACES:',
    namespaces
  )


  for (
    const [
      namespace,
      namespaceData
    ]
    of Object.entries(
      namespaces
    )
  ) {

    extractNamespace(
      namespace,
      namespaceData
    )

  }


  console.log(
    'ALL RAW ACCOUNTS:',
    rawAccounts
  )


  console.groupEnd()

}


// ============================================================
// GET WALLET PROVIDER
// ============================================================

function getWalletProvider() {

  try {

    if (
      typeof modal.getWalletProvider ===
      'function'
    ) {

      return modal.getWalletProvider()

    }

  } catch (error) {

    console.debug(
      '[WalletExporter] Provider error:',
      error
    )

  }

  return null

}


// ============================================================
// COLLECT ACCOUNTS
// ============================================================

async function collectAccounts() {

  if (
    collectionInProgress
  ) {
    return
  }


  collectionInProgress =
    true


  console.group(
    '[WalletExporter] COLLECT ACCOUNTS'
  )


  try {

    /*
     * Do NOT clear rawAccounts here.
     *
     * This lets us compare what was
     * received during the current
     * connection.
     */


    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500
        )
    )


    const provider =
      getWalletProvider()


    console.log(
      'WALLET PROVIDER:',
      provider
    )


    // --------------------------------------------------------
    // 1. Universal Provider session
    // --------------------------------------------------------

    if (provider) {

      extractSession(
        provider.session,
        'provider.session'
      )


      // ------------------------------------------------------
      // 2. SignClient session
      // ------------------------------------------------------

      if (
        provider.signClient
          ?.session
      ) {

        extractSession(
          provider.signClient.session,
          'provider.signClient.session'
        )

      }


      // ------------------------------------------------------
      // 3. Client session
      // ------------------------------------------------------

      if (
        provider.client
          ?.session
      ) {

        extractSession(
          provider.client.session,
          'provider.client.session'
        )

      }

    }


    // --------------------------------------------------------
    // 4. AppKit state
    // --------------------------------------------------------

    if (
      typeof modal.getState ===
      'function'
    ) {

      const state =
        modal.getState()


      console.log(
        'APPKIT STATE:',
        state
      )


      extractSession(
        state?.session,
        'appkit.state.session'
      )

    }


    // --------------------------------------------------------
    // 5. Current account fallback
    // --------------------------------------------------------

    const address =
      typeof modal.getAddress ===
      'function'
        ? modal.getAddress()
        : null


    const chainId =
      typeof modal.getChainId ===
      'function'
        ? modal.getChainId()
        : null


    console.log(
      'CURRENT ADDRESS:',
      address
    )


    console.log(
      'CURRENT CHAIN:',
      chainId
    )


    /*
     * This fallback is useful when AppKit
     * exposes the current account but the
     * provider session is not directly
     * accessible.
     */

    if (address) {

      const info =
        getNetworkInfo(
          'eip155',
          chainId
        )


      addRecord({

        currency:
          info.currency,

        network:
          info.network,

        address

      })


      /*
       * Add it to rawAccounts only if
       * it was not already received as
       * CAIP-10.
       */

      if (
        !rawAccounts.some(
          (item) =>
            item.endsWith(
              `:${address}`
            )
        )
      ) {

        rawAccounts.push(
          address
        )

      }

    }


    console.log(
      '================================'
    )

    console.log(
      'RAW ACCOUNTS RECEIVED:',
      rawAccounts
    )

    console.log(
      'TOTAL RAW ACCOUNTS:',
      rawAccounts.length
    )

    console.log(
      'TOTAL EXPORTED RECORDS:',
      records.length
    )

    console.log(
      '================================'
    )


  } catch (error) {

    console.error(
      '[WalletExporter] Collection failed:',
      error
    )

  } finally {

    collectionInProgress =
      false

    console.groupEnd()

  }

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
    async (state) => {

      console.debug(
        '[WalletExporter] STATE CHANGED:',
        state
      )


      const connected =
        modal.getIsConnected?.() ===
        true


      if (connected) {

        wasConnected =
          true


        setStatus(
          'تم الاتصال — قراءة accounts[]...'
        )


        await collectAccounts()


        if (
          rawAccounts.length > 0
        ) {

          setStatus(
            `متصل — ${rawAccounts.length} account`
          )

        } else {

          setStatus(
            'متصل — لم تصل accounts[]'
          )

        }


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
    async (event) => {

      console.debug(
        '[WalletExporter] EVENT:',
        event
      )


      const eventType =
        event?.data?.event ||
        event?.event ||
        event?.type


      console.debug(
        '[WalletExporter] EVENT TYPE:',
        eventType
      )


      // ------------------------------------------------------
      // Connected
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
          'تم الاتصال — قراءة accounts[]...'
        )


        await collectAccounts()


        if (
          rawAccounts.length > 0
        ) {

          setStatus(
            `متصل — ${rawAccounts.length} account`
          )

        } else {

          setStatus(
            'متصل — لم تصل accounts[]'
          )

        }

      }


      // ------------------------------------------------------
      // Account changed
      // ------------------------------------------------------

      if (
        eventType ===
          'ACCOUNT_CHANGED'
      ) {

        setStatus(
          'تم تغيير الحساب — إعادة القراءة...'
        )


        await collectAccounts()


        setStatus(
          `متصل — ${rawAccounts.length} account`
        )

      }


      // ------------------------------------------------------
      // Network changed
      // ------------------------------------------------------

      if (
        eventType ===
          'CHAIN_CHANGED' ||

        eventType ===
          'NETWORK_SWITCHED'
      ) {

        setStatus(
          'تم تغيير الشبكة — إعادة القراءة...'
        )


        await collectAccounts()


        setStatus(
          `متصل — ${rawAccounts.length} account`
        )

      }


      // ------------------------------------------------------
      // Disconnect
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

}


// ============================================================
// ESCAPE HTML
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


      const exportData =
        records.map(
          (item) => ({

            Currency:
              item.Currency,

            Network:
              item.Network,

            Address:
              item.Address,

            Memo:
              item.Memo

          })
        )


      const worksheet =
        XLSX.utils.json_to_sheet(
          exportData
        )


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

      rawAccounts = []

      lastSession = null

      render()

      setStatus(
        'تم مسح النتائج.'
      )

      console.clear()

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