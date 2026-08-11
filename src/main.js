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
// CURRENT DATA
// ============================================================

/*
 * هذه هي الحسابات الحالية التي وصلت من جلسة WalletConnect.
 *
 * Set يمنع التكرار تلقائيًا.
 *
 * لا نحتفظ بتحديثات قديمة على أنها حسابات جديدة.
 */
let currentAccounts = new Set()

/*
 * البيانات التي ستظهر في الجدول.
 */
let records = []

let wasConnected = false

let collectionInProgress = false

/*
 * يمنع عدة تحديثات متزامنة من الكتابة فوق بعضها.
 */
let collectionTimer = null


// ============================================================
// STATUS
// ============================================================

function setStatus(message) {

  if (status) {
    status.textContent = message
  }

}


// ============================================================
// STRING
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
// EVM NETWORKS
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


  // ----------------------------------------------------------
  // EVM
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Solana
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Bitcoin
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // TON
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // TRON
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // Unknown
  // ----------------------------------------------------------

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
// MEMO / TAG
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
      object[field] !== undefined &&
      object[field] !== null
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
    return
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


  /*
   * حماية إضافية من التكرار.
   */
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
    return
  }


  records.push(record)

}


// ============================================================
// ADD CAIP ACCOUNT
// ============================================================

function addCaipAccount(
  account,
  memo = ''
) {

  const parsed =
    parseCaip10(account)

  if (!parsed) {

    console.warn(
      '[WalletExporter] Invalid CAIP-10 account:',
      account
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
// EXTRACT NAMESPACE
// ============================================================

function extractNamespace(
  namespaceName,
  namespaceData,
  destinationSet
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


  const namespaceMemo =
    findMemo(
      namespaceData
    )


  console.group(
    `[WalletExporter] Namespace: ${namespace}`
  )


  console.log(
    'chains:',
    namespaceData.chains
  )


  console.log(
    'accounts[]:',
    accounts
  )


  /*
   * نأخذ accounts[] كما أرسلتها الجلسة.
   *
   * لا نستخدم getAddress هنا.
   */

  for (
    const account of accounts
  ) {

    if (
      typeof account !== 'string'
    ) {
      continue
    }


    const value =
      account.trim()


    if (!value) {
      continue
    }


    /*
     * Set يمنع التكرار.
     */
    destinationSet.add(value)


    /*
     * تحويل CAIP-10 إلى بيانات الجدول.
     */
    addCaipAccount(
      value,
      namespaceMemo
    )

  }


  console.groupEnd()

}


// ============================================================
// READ SESSION
// ============================================================

function readSessionAccounts() {

  /*
   * Set جديد في كل قراءة.
   *
   * هذا هو الإصلاح الأساسي.
   *
   * لا نضيف إلى البيانات القديمة.
   */
  const newAccounts =
    new Set()


  const provider =
    getWalletProvider()


  if (!provider) {

    console.warn(
      '[WalletExporter] No wallet provider'
    )

    return newAccounts

  }


  // ----------------------------------------------------------
  // provider.session
  // ----------------------------------------------------------

  if (provider.session) {

    extractSession(
      provider.session,
      'provider.session',
      newAccounts
    )

  }


  // ----------------------------------------------------------
  // signClient session
  // ----------------------------------------------------------

  if (
    provider.signClient?.session
  ) {

    extractSession(
      provider.signClient.session,
      'provider.signClient.session',
      newAccounts
    )

  }


  // ----------------------------------------------------------
  // client session
  // ----------------------------------------------------------

  if (
    provider.client?.session
  ) {

    extractSession(
      provider.client.session,
      'provider.client.session',
      newAccounts
    )

  }


  // ----------------------------------------------------------
  // AppKit state
  // ----------------------------------------------------------

  if (
    typeof modal.getState ===
    'function'
  ) {

    const state =
      modal.getState()


    console.log(
      '[WalletExporter] AppKit state:',
      state
    )


    /*
     * بعض الإصدارات قد توفر session هنا.
     */
    if (state?.session) {

      extractSession(
        state.session,
        'appkit.state.session',
        newAccounts
      )

    }

  }


  return newAccounts

}


// ============================================================
// EXTRACT SESSION
// ============================================================

function extractSession(
  session,
  source,
  destinationSet
) {

  if (!session) {
    return
  }


  console.group(
    `[WalletExporter] SESSION: ${source}`
  )


  console.log(
    'FULL SESSION:',
    session
  )


  const namespaces =
    session.namespaces ||
    {}


  console.log(
    'NAMESPACES:',
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
      namespaceData,
      destinationSet
    )

  }


  console.groupEnd()

}


// ============================================================
// PROVIDER
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

    console.error(
      '[WalletExporter] getWalletProvider error:',
      error
    )

  }

  return null

}


// ============================================================
// REBUILD TABLE FROM CURRENT SESSION
// ============================================================

function rebuildRecords(
  accounts
) {

  /*
   * مهم جدًا:
   *
   * نحذف النتائج القديمة بالكامل.
   */
  records = []


  /*
   * نقرأ كل account مرة واحدة فقط.
   */
  for (
    const account of accounts
  ) {

    addCaipAccount(
      account
    )

  }


  render()

}


// ============================================================
// COLLECT CURRENT ACCOUNTS
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
    '[WalletExporter] COLLECT CURRENT ACCOUNTS'
  )


  try {

    /*
     * انتظار قصير حتى تنتهي WalletConnect
     * من تحديث الجلسة.
     */
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          300
        )
    )


    const newAccounts =
      readSessionAccounts()


    /*
     * --------------------------------------------------------
     * إذا وجدنا accounts[] من WalletConnect
     * نستخدمها فقط.
     * --------------------------------------------------------
     */

    if (
      newAccounts.size > 0
    ) {

      currentAccounts =
        newAccounts


      console.log(
        'CURRENT UNIQUE ACCOUNTS:',
        [...currentAccounts]
      )


      console.log(
        'CURRENT UNIQUE ACCOUNT COUNT:',
        currentAccounts.size
      )


      rebuildRecords(
        currentAccounts
      )


      setStatus(
        `متصل — ${currentAccounts.size} حساب`
      )


      console.groupEnd()

      return

    }


    /*
     * --------------------------------------------------------
     * FALLBACK
     *
     * لا نستخدم getAddress إلا إذا لم تصل
     * أي accounts[] من الجلسة.
     * --------------------------------------------------------
     */

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
      'FALLBACK ADDRESS:',
      address
    )


    if (address) {

      const fallbackAccount =
        `eip155:${chainId}:${address}`


      currentAccounts =
        new Set([
          fallbackAccount
        ])


      records = []


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


      render()


      setStatus(
        'متصل — 1 حساب'
      )


      console.groupEnd()

      return

    }


    /*
     * لا توجد بيانات.
     */

    currentAccounts =
      new Set()

    records = []

    render()


    setStatus(
      'متصل — لم تصل أي accounts[]'
    )


  } catch (error) {

    console.error(
      '[WalletExporter] Collection error:',
      error
    )


    setStatus(
      'حدث خطأ أثناء قراءة الحسابات'
    )

  } finally {

    collectionInProgress =
      false

    console.groupEnd()

  }

}


// ============================================================
// SCHEDULE COLLECTION
// ============================================================

function scheduleCollection(
  delay = 500
) {

  if (collectionTimer) {

    clearTimeout(
      collectionTimer
    )

  }


  collectionTimer =
    setTimeout(
      async () => {

        collectionTimer =
          null

        await collectAccounts()

      },
      delay
    )

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


        await modal.open({
          view: 'Connect'
        })


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
          'تم الاتصال — قراءة الحسابات...'
        )


        scheduleCollection(
          500
        )


        return

      }


      /*
       * إذا انقطع الاتصال:
       * نمسح البيانات الحالية.
       */

      if (wasConnected) {

        currentAccounts =
          new Set()

        records = []

        render()


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
      // CONNECT
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
          'تم الاتصال — قراءة الحسابات...'
        )


        scheduleCollection(
          700
        )

      }


      // ------------------------------------------------------
      // ACCOUNT CHANGED
      // ------------------------------------------------------

      if (
        eventType ===
          'ACCOUNT_CHANGED'
      ) {

        setStatus(
          'تم تغيير الحساب — تحديث...'
        )


        scheduleCollection(
          700
        )

      }


      // ------------------------------------------------------
      // CHAIN CHANGED
      // ------------------------------------------------------

      if (
        eventType ===
          'CHAIN_CHANGED' ||

        eventType ===
          'NETWORK_SWITCHED'
      ) {

        setStatus(
          'تم تغيير الشبكة — تحديث...'
        )


        scheduleCollection(
          700
        )

      }


      // ------------------------------------------------------
      // SESSION UPDATED
      // ------------------------------------------------------

      if (
        eventType ===
          'SESSION_UPDATE' ||

        eventType ===
          'SESSION_UPDATED' ||

        eventType ===
          'UPDATE'
      ) {

        setStatus(
          'تم تحديث جلسة المحفظة — تحديث الحسابات...'
        )


        scheduleCollection(
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


        currentAccounts =
          new Set()

        records = []

        render()


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

  const total =
    records.length


  if (count) {

    count.textContent =
      total

  }


  if (!table) {
    return
  }


  if (
    total === 0
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

      currentAccounts =
        new Set()

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

console.log(
  '[WalletExporter] Initialized'
)