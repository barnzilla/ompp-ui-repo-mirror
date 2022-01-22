import { mapState, mapGetters } from 'vuex'
import * as Mdf from 'src/model-common'
import NewRunInit from 'components/NewRunInit.vue'
import RunBar from 'components/RunBar.vue'
import WorksetBar from 'components/WorksetBar.vue'
import RunInfoDialog from 'components/RunInfoDialog.vue'
import WorksetInfoDialog from 'components/WorksetInfoDialog.vue'
import MarkdownEditor from 'components/MarkdownEditor.vue'

export default {
  name: 'NewRun',
  components: { NewRunInit, RunBar, WorksetBar, RunInfoDialog, WorksetInfoDialog, MarkdownEditor },

  props: {
    digest: { type: String, default: '' },
    refreshTickle: { type: Boolean, default: false }
  },

  data () {
    return {
      isInitRun: false,
      runCurrent: Mdf.emptyRunText(), // currently selected run
      worksetCurrent: Mdf.emptyWorksetText(), // currently selected workset
      useWorkset: false,
      useBaseRun: false,
      runTemplateLst: [],
      mpiTemplateLst: [],
      presetLst: [],
      profileLst: [],
      enableIni: false,
      enableIniAnyKey: false,
      csvCodeId: 'enumCode',
      runOpts: {
        runName: '',
        worksetName: '',
        baseRunDigest: '',
        runDescr: {}, // run description[language code]
        subCount: 1,
        threadCount: 1,
        progressPercent: 1,
        progressStep: 0,
        workDir: '',
        csvDir: '',
        csvId: false,
        iniName: '',
        useIni: false,
        iniAnyKey: false,
        profile: '',
        sparseOutput: false,
        runTmpl: '',
        mpiNpCount: 0,
        mpiOnRoot: false,
        mpiTmpl: ''
      },
      newRunNotes: {
        type: Object,
        default: () => ({})
      },
      loadWait: false,
      isRunOptsShow: true,
      runInfoTickle: false,
      worksetInfoTickle: false,
      txtNewRun: [] // array for run description and notes
    }
  },

  computed: {
    isNotEmptyRunCurrent () { return Mdf.isNotEmptyRunText(this.runCurrent) },
    isNotEmptyWorksetCurrent () { return Mdf.isNotEmptyWorksetText(this.worksetCurrent) },
    isNotEmptyLanguageList () { return Mdf.isLangList(this.langList) },
    isEmptyProfileList () { return !Mdf.isLength(this.profileLst) },
    isEmptyRunTemplateList () { return !Mdf.isLength(this.runTemplateLst) },
    // return true if current can be used for model run: if workset in read-only state
    isReadonlyWorksetCurrent () {
      return this.worksetNameSelected && this.worksetCurrent?.IsReadonly
    },
    // retrun true if current run is completed: success, error or exit
    // if run not successfully completed then it we don't know is it possible to use as base run
    isCompletedRunCurrent () {
      return this.runDigestSelected && Mdf.isRunCompleted(this.runCurrent)
    },

    ...mapState('model', {
      theModel: state => state.theModel,
      langList: state => state.langList
    }),
    ...mapGetters('model', {
      runTextByDigest: 'runTextByDigest',
      isExistInRunTextList: 'isExistInRunTextList',
      worksetTextByName: 'worksetTextByName',
      modelLanguage: 'modelLanguage'
    }),
    ...mapState('uiState', {
      runDigestSelected: state => state.runDigestSelected,
      worksetNameSelected: state => state.worksetNameSelected
    }),
    ...mapState('serverState', {
      omsUrl: state => state.omsUrl,
      serverConfig: state => state.config
    })
  },

  watch: {
    digest () { this.doRefresh() },
    refreshTickle () { this.doRefresh() }
  },

  methods: {
    // update page view
    doRefresh () {
      this.runCurrent = this.runTextByDigest({ ModelDigest: this.digest, RunDigest: this.runDigestSelected })
      this.worksetCurrent = this.worksetTextByName({ ModelDigest: this.digest, Name: this.worksetNameSelected })

      // reset run options and state
      this.isInitRun = false

      this.runOpts.runName = ''
      this.runOpts.worksetName = ''
      this.runOpts.baseRunDigest = ''
      this.useWorkset = this.isReadonlyWorksetCurrent
      this.useBaseRun = this.isUseCurrentAsBaseRun()
      this.runOpts.sparseOutput = false
      this.mpiNpCount = 0
      this.runOpts.mpiOnRoot = false

      // get model run template list
      // append empty '' string first to allow model run without template
      // if default run template exist the select it
      this.runTemplateLst = []
      if (Mdf.isLength(this.serverConfig.RunCatalog.RunTemplates)) {
        const runDefaultTmpl = Mdf.configEnvValue(this.serverConfig, 'OM_CFG_DEFAULT_RUN_TMPL')
        let isFound = false

        this.runTemplateLst.push('')
        for (const p of this.serverConfig.RunCatalog.RunTemplates) {
          this.runTemplateLst.push(p)
          if (!isFound) isFound = p === runDefaultTmpl
        }
        this.runOpts.runTmpl = isFound ? runDefaultTmpl : this.runTemplateLst[0]
      }

      // get MPI run template list and select default template
      this.runOpts.mpiTmpl = ''
      this.mpiTemplateLst = this.serverConfig.RunCatalog.MpiTemplates
      const dTmpl = this.serverConfig.RunCatalog.DefaultMpiTemplate

      if (dTmpl && Mdf.isLength(this.mpiTemplateLst)) {
        let isFound = false
        for (let k = 0; !isFound && k < this.mpiTemplateLst.length; k++) {
          isFound = this.mpiTemplateLst[k] === dTmpl
        }
        this.runOpts.mpiTmpl = isFound ? dTmpl : this.mpiTemplateLst[0]
      }

      // check if usage of ini-file options allowed by server
      let cfgIni = Mdf.configEnvValue(this.serverConfig, 'OM_CFG_INI_ALLOW').toLowerCase()
      this.enableIni = cfgIni === 'true' || cfgIni === '1' || cfgIni === 'yes'
      this.runOpts.iniName = this.enableIni ? this.theModel.Model.Name + '.ini' : ''

      cfgIni = Mdf.configEnvValue(this.serverConfig, 'OM_CFG_INI_ANY_KEY').toLowerCase()
      this.enableIniAnyKey = this.enableIni && (cfgIni === 'true' || cfgIni === '1' || cfgIni === 'yes')

      if (!this.enableIni) this.runOpts.useIni = false
      if (!this.enableIniAnyKey) this.runOpts.iniAnyKey = false

      // get profile list from server
      this.runOpts.profile = ''
      this.doProfileListRefresh()

      // make list of model languages, description and notes for workset editor
      this.newRunNotes = {}

      this.txtNewRun = []
      if (Mdf.isLangList(this.langList)) {
        for (const lcn of this.langList) {
          this.txtNewRun.push({
            LangCode: lcn.LangCode,
            LangName: lcn.Name,
            Descr: '',
            Note: ''
          })
        }
      } else {
        if (!this.txtNewRun.length) {
          this.txtNewRun.push({
            LangCode: this.modelLanguage.LangCode,
            LangName: this.modelLanguage.Name,
            Descr: '',
            Note: ''
          })
        }
      }

      // get run options presets as array of { name, descr, opts{....} }
      this.presetLst = Mdf.configRunOptsPresets(this.serverConfig, this.theModel.Model.Name, this.modelLanguage.LangCode)
    },

    // use current run as base base run if:
    //   current run is compeleted and
    //   current workset not readonly
    //   or current workset not is full and current workset not based on run
    isUseCurrentAsBaseRun () {
      return this.isCompletedRunCurrent &&
        (
          !this.isReadonlyWorksetCurrent ||
          (
            (Mdf.worksetParamCount(this.worksetCurrent) !== Mdf.paramCount(this.theModel)) && // not a full workset
            (!this.worksetCurrent?.BaseRunDigest || !this.isExistInRunTextList({ ModelDigest: this.digest, RunDigest: this.worksetCurrent?.BaseRunDigest }))
          )
        )
    },
    // if use base run un-checked then user must supply full set of input parameters
    onUseBaseRunClick () {
      if (!this.useBaseRun && !this.runOpts.csvDir && this.isUseCurrentAsBaseRun()) {
        this.$q.notify({ type: 'warning', message: this.$t('Input scenario should include all parameters otherwise model run may fail') })
      }
    },

    // show current run info dialog
    doShowRunNote (modelDgst, runDgst) {
      if (modelDgst !== this.digest || runDgst !== this.runDigestSelected) {
        console.warn('invlaid model digest or run digest:', modelDgst, runDgst)
        return
      }
      this.runInfoTickle = !this.runInfoTickle
    },
    // show current workset notes dialog
    doShowWorksetNote (modelDgst, name) {
      if (modelDgst !== this.digest || name !== this.worksetNameSelected) {
        console.warn('invlaid model digest or workset name:', modelDgst, name)
        return
      }
      this.worksetInfoTickle = !this.worksetInfoTickle
    },

    // set default name of new model run
    onRunNameFocus (e) {
      if (typeof this.runOpts.runName !== typeof 'string' || (this.runOpts.runName || '') === '') {
        this.runOpts.runName = this.theModel.Model.Name + '_' + (this.isReadonlyWorksetCurrent ? this.worksetNameSelected + '_' : '') + Mdf.dtToUnderscoreTimeStamp(new Date())
      }
    },
    // check if run name entered and cleanup input to be compatible with file name rules
    onRunNameBlur (e) {
      const { isEntered, name } = Mdf.doFileNameClean(this.runOpts.runName)
      this.runOpts.runName = isEntered ? name : ''
    },
    // cleanup run description input
    onRunDescrBlur (e) {
      for (const lcd in this.runOpts.runDescr) {
        const descr = Mdf.cleanTextInput((this.runOpts.runDescr[lcd] || ''))
        this.runOpts.runDescr[lcd] = descr
      }
    },
    // check if working directory path entered and cleanup input to be compatible with file path rules
    onWorkDirBlur (e) {
      const { isEntered, dir } = this.doDirClean(this.runOpts.workDir)
      this.runOpts.workDir = isEntered ? dir : ''
    },
    // check if csv directory path entered and cleanup input to be compatible with file paths rules
    onCsvDirBlur () {
      const { isEntered, dir } = this.doDirClean(this.runOpts.csvDir)
      this.runOpts.csvDir = isEntered ? dir : ''
    },
    doDirClean (dirValue) {
      return (dirValue || '') ? { isEntered: true, dir: this.cleanPathInput(dirValue) } : { isEntered: false, dir: '' }
    },
    // clean integer as non-negative input, ignore + or - sign
    cleanIntNonNegativeInput (sValue, nDefault = 0) {
      if (sValue === '' || sValue === void 0) return nDefault
      const n = parseInt(sValue)
      return (!isNaN(n) && Number.isInteger(n)) ? n : nDefault
    },
    // clean float number input
    cleanFloatInput (sValue, fDefault = 0.0) {
      if (sValue === '' || sValue === void 0) return fDefault
      const f = parseFloat(sValue)
      return !isNaN(f) ? f : fDefault
    },
    // clean path input: remove special characters "'`$}{@><:|?*&^; and force it to be relative path and use / separator
    cleanPathInput (sValue) {
      if (sValue === '' || sValue === void 0) return ''

      // remove special characters and replace all \ with /
      let s = sValue.replace(/["'`$}{@><:|?*&^;]/g, '').replace(/\\/g, '/').trim()

      // replace repeated // with single / and remove all ..
      let n = s.length
      let nPrev = n
      do {
        nPrev = n
        s = s.replace('//', '/').replace(/\.\./g, '')
        n = s.length
      } while (n > 0 && nPrev !== n)

      // remove leading /
      s = s.replace(/^\//, '')
      return s || ''
    },

    // apply preset to run options
    onPresetSelected (idx) {
      if (!Array.isArray(this.presetLst) || idx < 0 || idx >= this.presetLst.length) {
        this.$q.notify({ type: 'warning', message: this.$t('Invalid run options') })
        console.warn('Invalid run options', idx)
        return
      }
      // merge preset with run options
      const ps = this.presetLst[idx].opts

      this.runOpts.threadCount = ps.threadCount ?? this.runOpts.threadCount
      this.runOpts.workDir = ps.workDir ?? this.runOpts.workDir
      this.runOpts.csvDir = ps.csvDir ?? this.runOpts.csvDir
      this.csvCodeId = ps.csvCodeId ?? this.csvCodeId
      if (this.enableIni) {
        this.runOpts.useIni = ps.useIni ?? this.runOpts.useIni
        if (this.enableIniAnyKey && this.runOpts.useIni) this.runOpts.iniAnyKey = ps.iniAnyKey ?? this.runOpts.iniAnyKey
      }
      this.runOpts.profile = ps.profile ?? this.runOpts.profile
      this.runOpts.sparseOutput = ps.sparseOutput ?? this.runOpts.sparseOutput
      this.runOpts.runTmpl = ps.runTmpl ?? this.runOpts.runTmpl
      this.runOpts.mpiNpCount = ps.mpiNpCount ?? this.runOpts.mpiNpCount
      this.runOpts.mpiOnRoot = ps.mpiOnRoot ?? this.runOpts.mpiOnRoot
      this.runOpts.mpiTmpl = ps.mpiTmpl ?? this.runOpts.mpiTmpl
      this.runOpts.progressPercent = ps.progressPercent ?? this.runOpts.progressPercent
      this.runOpts.progressStep = ps.progressStep ?? this.runOpts.progressStep

      this.$q.notify({ type: 'info', message: this.presetLst[idx].descr || this.presetLst[idx].label || (this.$t('Using Run Options') + ': ' + this.presetLst[idx].name || '') })
    },

    // run the model
    onModelRun () {
      // set new run options
      this.runOpts.runName = Mdf.cleanFileNameInput(this.runOpts.runName)
      this.runOpts.subCount = this.cleanIntNonNegativeInput(this.runOpts.subCount, 1)
      this.runOpts.threadCount = this.cleanIntNonNegativeInput(this.runOpts.threadCount, 1)
      this.runOpts.workDir = this.cleanPathInput(this.runOpts.workDir)
      this.runOpts.csvDir = this.cleanPathInput(this.runOpts.csvDir)
      this.runOpts.csvId = (this.csvCodeId || '') !== 'enumCode'
      this.runOpts.useIni = (this.enableIni && this.runOpts.useIni) || false
      this.runOpts.iniAnyKey = (this.enableIniAnyKey && this.runOpts.useIni && this.runOpts.iniAnyKey) || false
      this.runOpts.profile = Mdf.cleanTextInput(this.runOpts.profile)
      this.runOpts.sparseOutput = this.runOpts.sparseOutput || false
      this.runOpts.runTmpl = Mdf.cleanTextInput(this.runOpts.runTmpl)
      this.runOpts.mpiNpCount = this.cleanIntNonNegativeInput(this.runOpts.mpiNpCount, 0)
      this.runOpts.mpiOnRoot = this.runOpts.mpiOnRoot || false
      this.runOpts.mpiTmpl = Mdf.cleanTextInput(this.runOpts.mpiTmpl)
      this.runOpts.progressPercent = this.cleanIntNonNegativeInput(this.runOpts.progressPercent, 1)

      this.runOpts.progressStep = this.cleanFloatInput(this.runOpts.progressStep, 0.0)
      if (this.runOpts.progressStep < 0) this.runOpts.progressStep = 0.0

      this.runOpts.worksetName = (this.useWorkset && this.isReadonlyWorksetCurrent) ? this.worksetNameSelected || '' : ''
      this.runOpts.baseRunDigest = (this.useBaseRun && this.isCompletedRunCurrent) ? this.runDigestSelected || '' : ''

      // collect description and notes for each language
      this.newRunNotes = {}
      for (const t of this.txtNewRun) {
        const refKey = 'new-run-note-editor-' + t.LangCode
        if (!Mdf.isLength(this.$refs[refKey]) || !this.$refs[refKey][0]) continue

        const udn = this.$refs[refKey][0].getDescrNote()
        if ((udn.descr || udn.note || '') !== '') {
          this.runOpts.runDescr[t.LangCode] = udn.descr
          this.newRunNotes[t.LangCode] = udn.note
        }
      }

      // start new model run: send request to the server
      this.isInitRun = true
      this.loadWait = true
    },

    // new model run started: response from server
    doneNewRunInit (ok, stamp) {
      this.isInitRun = false
      this.loadWait = false
      this.$emit('run-list-refresh')

      if (!ok) {
        this.$q.notify({ type: 'negative', message: this.$t('Server offline or model run failed to start') })
        return
      }
      // model started
      if (!stamp) {
        this.$q.notify({ type: 'negative', message: this.$t('Unable to show run log: run stamp is empty') })
        return
      }
      this.$emit('run-log-select', stamp)
    },

    // receive profile list by model digest
    async doProfileListRefresh () {
      let isOk = false
      this.loadWait = true

      const u = this.omsUrl + '/api/model/' + this.digest + '/profile-list'
      try {
        const response = await this.$axios.get(u)

        // expected string array of profile names
        // append empty '' string first to make default selection === "no profile"
        this.profileLst = []
        if (Mdf.isLength(response.data)) {
          this.profileLst.push('')
          for (const p of response.data) {
            this.profileLst.push(p)
          }
        }
        isOk = true
      } catch (e) {
        let em = ''
        try {
          if (e.response) em = e.response.data || ''
        } finally {}
        console.warn('Server offline or profile list retrive failed.', em)
      }
      if (!isOk) {
        this.$q.notify({ type: 'negative', message: this.$t('Server offline or profile list retrive failed') + ': ' + this.digest })
      }
      this.loadWait = false
    }
  },

  mounted () {
    this.doRefresh()
    this.$emit('tab-mounted', 'new-run', { digest: this.digest })
  }
}
