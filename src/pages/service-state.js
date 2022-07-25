import { mapState } from 'vuex'
import * as Mdf from 'src/model-common'
import JobInfoCard from 'components/JobInfoCard.vue'
import DeleteConfirmDialog from 'components/DeleteConfirmDialog.vue'

/* eslint-disable no-multi-spaces */
const STATE_REFRESH_TIME = 1601       // msec, service state refresh interval
const MAX_STATE_SEND_COUNT = 5        // max request to send without response
const MAX_NO_STATE_COUNT = 4          // max invalid response count
/* eslint-enable no-multi-spaces */

export default {
  name: 'ServiceState',
  components: { JobInfoCard, DeleteConfirmDialog },

  props: {
    refreshTickle: { type: Boolean, default: false }
  },

  data () {
    return {
      srvState: Mdf.emptyServiceState(),
      activeJob: {},
      queueJob: {},
      historyJob: {},
      isActiveShow: false,
      isQueueShow: false,
      isHistoryShow: false,
      isRefreshPaused: false,
      isRefreshDisabled: false,
      stateRefreshTickle: 0,
      stateSendCount: 0,
      stateNoDataCount: 0,
      stateRefreshInt: '',
      stopRunTitle: '',
      stopSubmitStamp: '',
      stopModelDigest: '',
      showStopRunTickle: false
    }
  },

  computed: {
    ...mapState('serverState', {
      omsUrl: state => state.omsUrl,
      serverConfig: state => state.config
    })
  },

  watch: {
    refreshTickle () { this.initView() }
  },

  methods: {
    isUnderscoreTs (ts) { return Mdf.isUnderscoreTimeStamp(ts) },
    fromUnderscoreTs (ts) { return Mdf.isUnderscoreTimeStamp(ts) ? Mdf.fromUnderscoreTimeStamp(ts) : ts },
    isSuccess (status) { return status === 'success' },
    isInProgress (status) { return status === 'progress' || status === 'init' || status === 'wait' },
    runStatusDescr (status) { return Mdf.statusText(status) },
    isActiveJob (stamp) { return !!stamp && Mdf.isNotEmptyJobItem(this.activeJob[stamp]) },
    isQueueJob (stamp) { return !!stamp && Mdf.isNotEmptyJobItem(this.queueJob[stamp]) },
    isHistoryJob (stamp) { return !!stamp && Mdf.isNotEmptyJobItem(this.historyJob[stamp]) },
    getRunTitle (jobItem) { return Mdf.getJobRunTitle(jobItem) },

    // return true if job is first in the queue
    isTopQueue (stamp) {
      return this.srvState.Queue.findIndex((jc) => jc.SubmitStamp === stamp) <= 0
    },
    // return true if job is last in the queue
    isBottomQueue (stamp) {
      return this.srvState.Queue.findIndex((jc) => jc.SubmitStamp === stamp) >= this.srvState.Queue.length - 1
    },

    // update page view
    initView () {
      this.srvState = Mdf.emptyServiceState()
      this.stopRefresh()
      this.startRefresh()
      this.isActiveShow = true
      this.isQueueShow = false
      this.isHistoryShow = false
      this.activeJob = {}
      this.queueJob = {}
      this.historyJob = {}
    },

    // refersh service state
    onStateRefresh () {
      if (this.isRefreshPaused) {
        return
      }
      this.stateRefreshTickle = !this.stateRefreshTickle
      if (this.stateSendCount < MAX_STATE_SEND_COUNT) {
        this.doStateRefresh()
      }
    },
    refreshPauseToggle () {
      this.stateSendCount = 0
      this.stateNoDataCount = 0
      this.isRefreshPaused = !this.isRefreshPaused
    },
    startRefresh () {
      this.isRefreshPaused = false
      this.isRefreshDisabled = false
      this.stateSendCount = 0
      this.stateNoDataCount = 0
      this.stateRefreshInt = setInterval(this.onStateRefresh, STATE_REFRESH_TIME)
    },
    stopRefresh () {
      this.isRefreshDisabled = true
      clearInterval(this.stateRefreshInt)
    },

    // show or hide active job item
    onActiveShow (stamp) {
      if (stamp) this.getJobState('active', stamp)
    },
    onActiveHide (stamp) {
      if (stamp) this.activeJob[stamp] = Mdf.emptyJobItem(stamp)
    },
    // show or hide queue job item
    onQueueShow (stamp) {
      this.getJobState('queue', stamp)
    },
    onQueueHide (stamp) {
      if (stamp) this.queueJob[stamp] = Mdf.emptyJobItem(stamp)
    },
    // show or hide job history item
    onHistoryShow (stamp) {
      this.getJobState('history', stamp)
    },
    onHistoryHide (stamp) {
      if (stamp) this.historyJob[stamp] = Mdf.emptyJobItem(stamp)
    },

    // add new job control items into active, queue and history jobs
    // remove state of a job which is no longer exist in active or queue or history
    updateJobsState () {
      // remove state of a job which is no longer exist in active or queue or history
      for (const stamp in this.activeJob) {
        if (this.srvState.Active.findIndex((jc) => jc.SubmitStamp === stamp) < 0) this.activeJob[stamp] = ''
      }
      for (const stamp in this.queueJob) {
        if (this.srvState.Queue.findIndex((jc) => jc.SubmitStamp === stamp) < 0) this.queueJob[stamp] = ''
      }
      for (const stamp in this.historyJob) {
        if (this.srvState.History.findIndex((jc) => jc.SubmitStamp === stamp) < 0) this.historyJob[stamp] = ''
      }

      // add new job control items into active, queue and history jobs
      for (const aj of this.srvState.Active) {
        if ((this.activeJob[aj.SubmitStamp] || '') === '') this.activeJob[aj.SubmitStamp] = Mdf.isJobItem(aj) ? aj : Mdf.emptyJobItem(aj.SubmitStamp)
      }
      for (const qj of this.srvState.Queue) {
        if ((this.queueJob[qj.SubmitStamp] || '') === '') this.queueJob[qj.SubmitStamp] = Mdf.isJobItem(qj) ? qj : Mdf.emptyJobItem(qj.SubmitStamp)
      }
      for (const hj of this.srvState.History) {
        if ((this.historyJob[hj.SubmitStamp] || '') === '') this.historyJob[hj.SubmitStamp] = Mdf.isJobItem(hj) ? hj : Mdf.emptyJobItem(hj.SubmitStamp)
      }
    },

    // receive server configuration, including configuration of model catalog and run catalog
    async doStateRefresh () {
      this.stateSendCount++

      const u = this.omsUrl + '/api/service/state'
      try {
        // send request to the server
        const response = await this.$axios.get(u)
        const std = response?.data
        if (Mdf.isServiceState(std)) { // if response is a server state
          this.stateSendCount = 0
          this.stateNoDataCount = 0
          //
          std.History.reverse() // display history in reverse order: latest runs first
          this.srvState = std
          this.updateJobsState()
        } else {
          this.stateNoDataCount++
        }
      } catch (e) {
        let em = ''
        try {
          if (e.response) em = e.response.data || ''
        } finally {}
        if (this.stateNoDataCount++ <= MAX_NO_STATE_COUNT) {
          console.warn('Server offline or state retrieval failed.', em)
        }
      }
      if (this.stateNoDataCount > MAX_NO_STATE_COUNT) {
        this.isRefreshPaused = true
        this.$q.notify({ type: 'negative', message: this.$t('Server offline or state retrieval failed.') })
        return
      }

      // refresh active jobs state
      if (this.isActiveShow) {
        for (const stamp in this.activeJob) {
          if (Mdf.isNotEmptyJobItem(this.activeJob[stamp])) this.getJobState('active', stamp)
        }
      }
    },

    // get active or queue or history job item by submission stamp
    async getJobState (kind, stamp) {
      if (!kind || typeof kind !== typeof 'string' || (kind !== 'active' && kind !== 'queue' && kind !== 'history')) {
        console.warn('Invalid argument, it must be: active, queue or history:', kind)
        this.$q.notify({ type: 'negative', message: this.$t('Invalid argument, it must be: active, queue or history') })
        return
      }
      if (!stamp || typeof stamp !== typeof 'string' || (stamp || '') === '') {
        console.warn('Invalid (empty) submission stamp:', stamp)
        this.$q.notify({ type: 'negative', message: this.$t('Invalid (empty) submission stamp') })
        return
      }

      let isOk = false
      let jc = {}
      const u = this.omsUrl + '/api/service/job/' + kind + '/' + encodeURIComponent(stamp)
      try {
        // send request to the server
        const response = await this.$axios.get(u)
        jc = response.data
        isOk = true
      } catch (e) {
        let em = ''
        try {
          if (e.response) em = e.response.data || ''
        } finally {}
        console.warn('Unable to get job control state:', kind, stamp, em)
      }

      if (isOk) {
        switch (kind) {
          case 'active':
            this.activeJob[stamp] = Mdf.isJobItem(jc) ? jc : Mdf.emptyJobItem(stamp)
            break
          case 'queue':
            this.queueJob[stamp] = Mdf.isJobItem(jc) ? jc : Mdf.emptyJobItem(stamp)
            break
          case 'history':
            this.historyJob[stamp] = Mdf.isJobItem(jc) ? jc : Mdf.emptyJobItem(stamp)
            break
          default:
            isOk = false
        }
      }
      if (!isOk) {
        console.warn('Unable to set job control state:', kind, stamp)
        this.$q.notify({ type: 'negative', message: this.$t('Unable to retrieve model run state') + ': ' + kind + ' ' + stamp })
      }
    },

    // stop model run: ask user confirmation to kill model run
    onStopJobConfirm (stamp, mDigest, mName) {
      if (!mDigest || !stamp) {
        const s = (mName || mDigest || '') + ' ' + (stamp || '') + ' '
        this.$q.notify({ type: 'negative', message: this.$t('Unable to find active model run') + ': ' + s })
        return
      }
      this.stopRunTitle = mName + ' ' + this.fromUnderscoreTs(stamp)
      this.stopSubmitStamp = stamp
      this.stopModelDigest = mDigest
      this.showStopRunTickle = !this.showStopRunTickle
    },
    // user answer is Yes to stop model run
    async onYesStopRun (title, stamp, mDgst) {
      if (!mDgst || !stamp) {
        console.warn('Unable to stop: model digest or submit stamp is empty', mDgst, stamp)
        this.$q.notify({ type: 'negative', message: this.$t('Unable to stop: model digest or submit stamp is empty') })
        return
      }

      const u = this.omsUrl +
        '/api/run/stop/model/' + encodeURIComponent(mDgst) +
        '/stamp/' + encodeURIComponent(stamp)
      try {
        await this.$axios.put(u) // ignore response on success
      } catch (e) {
        console.warn('Unable to stop model run', e)
        this.$q.notify({ type: 'negative', message: this.$t('Unable to stop model run') + ': ' + title })
        return // exit on error
      }

      // notify user on success, even run may not exist
      this.$q.notify({ type: 'info', message: this.$t('Stopping model run') + ': ' + title })
    },

    async onJobMove (stamp, pos, mDigest, mName) {
      const title = (mName || mDigest || '') + ' ' + (this.fromUnderscoreTs(stamp) || '') + ' '
      if (!stamp || typeof pos !== typeof 1) {
        console.warn('Unable to move model run', pos, stamp)
        this.$q.notify({ type: 'negative', message: this.$t('Unable to move model run') + ': ' + title })
        return
      }

      const u = this.omsUrl + '/api/service/job/move/' + (pos.toString()) + '/' + encodeURIComponent(stamp)
      try {
        await this.$axios.put(u) // ignore response on success
      } catch (e) {
        console.warn('Unable to move model run', e)
        this.$q.notify({ type: 'negative', message: this.$t('Unable to move model run') + ': ' + title })
        return // exit on error
      }

      // notify user on success, even run may not exist
      this.$q.notify({ type: 'info', message: this.$t('Moving model run') + ': ' + title })
    }
  },

  mounted () {
    this.initView()
  },
  beforeDestroy () {
    this.stopRefresh()
  }
}
