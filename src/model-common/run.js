// db structures common functions: model run and run list

import * as Hlpr from './helper'

// run count: number of run text entries in the run text list
export const runTextCount = (rtl) => {
  return isRunTextList(rtl) ? rtl.length : 0
}

// return true if each list element isRunText()
export const isRunTextList = (rtl) => {
  if (!rtl) return false
  if (!Array.isArray(rtl)) return false
  for (let k = 0; k < rtl.length; k++) {
    if (!isRunText(rtl[k])) return false
  }
  return true
}

// if this is run text
export const isRunText = (rt) => {
  if (!rt) return false
  if (!rt.hasOwnProperty('ModelName') || !rt.hasOwnProperty('ModelDigest')) return false
  if (!rt.hasOwnProperty('Name') || !rt.hasOwnProperty('RunDigest') || !rt.hasOwnProperty('ValueDigest')) return false
  if (!rt.hasOwnProperty('RunStamp') || !rt.hasOwnProperty('SubCount') || !rt.hasOwnProperty('Status')) return false
  if (!rt.hasOwnProperty('CreateDateTime') || !rt.hasOwnProperty('UpdateDateTime')) return false
  if (!Array.isArray(rt.Param) || !Array.isArray(rt.Table) || !Array.isArray(rt.Txt)) return false
  return true
}

// if this is not empty run text: model name, model digest, run name, run digest, run stamp, status, sub-count, create date-time
export const isNotEmptyRunText = (rt) => {
  if (!isRunText(rt)) return false
  return (rt.ModelName || '') !== '' && (rt.ModelDigest || '') !== '' &&
    (rt.Name || '') !== '' && (rt.RunDigest || '') !== '' && (rt.RunStamp || '') !== '' &&
    (rt.Status || '') !== '' && (rt.SubCount || 0) !== 0 && (rt.CreateDateTime || '') !== ''
}

// return empty run text
export const emptyRunText = () => {
  return {
    ModelName: '',
    ModelDigest: '',
    Name: '',
    RunDigest: '',
    ValueDigest: '',
    RunStamp: '',
    SubCount: 0,
    Status: '',
    CreateDateTime: '',
    UpdateDateTime: '',
    Param: [],
    Table: [],
    Txt: []
  }
}

// return true if this is not the same run text or it is updated: different run status or update time.
export const isRunTextUpdated = (rt, rtOther) => {
  if (!isNotEmptyRunText(rt) || !isNotEmptyRunText(rtOther)) return false

  return rt.ModelDigest !== rtOther.ModelDigest || rt.RunDigest !== rtOther.RunDigest ||
    rt.Status !== rtOther.Status || rt.UpdateDateTime !== rtOther.UpdateDateTime
}

// find last model run: last successful or last completed or last in the model run list
export const lastRunDigest = (rtl) => {
  if (!rtl) return ''
  if (!Array.isArray(rtl)) return ''

  let lastDg = ''
  let lastCompleted = ''
  for (let k = 0; k < rtl.length; k++) {
    if (isRunSuccess(rtl[k])) return rtl[k].RunDigest
    if (!lastCompleted && isRunCompleted(rtl[k])) lastCompleted = rtl[k].RunDigest
    if (!lastDg) lastDg = rtl[k].RunDigest
  }
  return lastCompleted || lastDg
}

// retrun true if table included in run text: find table name in run tables array
export const isRunTextHasTable = (rt, name) => {
  if (!name || !isNotEmptyRunText(rt)) return false

  for (let k = 0; k < rt.Table.length; k++) {
    if ((rt.Table[k]?.Name || '') === name) return true
  }
  return false
}

// return empty run table
export const emptyRunTable = () => {
  return {
    Name: '',
    ValueDigest: ''
  }
}

// if this is not empty run table: table Name is not empty and ValueDigest is a string
export const isNotEmptyRunTable = (rtbl) => {
  return rtbl &&
    rtbl?.Name && typeof rtbl.Name === typeof 'string' && rtbl.Name &&
    rtbl.hasOwnProperty('ValueDigest') && typeof rtbl.ValueDigest === typeof 'string'
}

// find run Table by table name in Table[] array of run text
// return empty value if not found
export const runTableByName = (rt, name) => {
  if (!name || !isNotEmptyRunText(rt)) return emptyRunTable()

  for (let k = 0; k < rt.Table.length; k++) {
    if ((rt.Table[k]?.Name || '') === name) return Hlpr._cloneDeep(rt.Table[k])
  }
  return emptyRunTable() // not found
}

/* eslint-disable no-multi-spaces */
export const RUN_SUCCESS = 's'      // run completed successfuly
export const RUN_IN_PROGRESS = 'p'  // run in progress
export const RUN_INITIAL = 'i'      // run not started yet
export const RUN_WAIT = 'w'         // task run paused
export const RUN_FAILED = 'e'       // run falied (comleted with error)
export const RUN_EXIT = 'x'         // run exit and not completed
/* eslint-enable no-multi-spaces */

// retrun true if run completed successfuly
export const isRunSuccess = (rt) => {
  return isRunText(rt) && rt.Status === RUN_SUCCESS
}

// retrun true if run in progress
export const isRunInProgress = (rt) => {
  return isRunText(rt) && (rt.Status === RUN_IN_PROGRESS || rt.Status === RUN_INITIAL)
}

// retrun true if run completed, status is one of: s=success, x=exit, e=error
export const isRunCompleted = (rt) => {
  return isRunText(rt) && isRunCompletedStatus(rt.Status)
}

// retrun true if run completed, status is one of: s=success, x=exit, e=error
export const isRunCompletedStatus = (code) => {
  return code === RUN_SUCCESS || code === RUN_EXIT || code === RUN_FAILED
}

// return run status description, e.g: i=init p=progress s=success x=exit e=error(failed)
export const statusText = (status) => {
  switch (status || '') {
    case RUN_SUCCESS: return 'success'
    case RUN_IN_PROGRESS: return 'in progress'
    case RUN_INITIAL: return 'initial'
    case RUN_WAIT: return 'waiting'
    case RUN_FAILED: return 'failed'
    case RUN_EXIT: return 'exit (not completed)'
    case 'success': return 'success'
    case 'in progress': return 'in progress'
    case 'progress': return 'in progress'
    case 'init': return 'initial'
    case 'initial': return 'initial'
    case 'wait': return 'waiting'
    case 'waiting': return 'waiting'
    case 'failed': return 'failed'
    case 'error': return 'failed'
    case 'exit': return 'exit (not completed)'
    case 'exit (not completed)': return 'exit (not completed)'
  }
  return 'unknown'
}

// RunState: model run state from oms run catalog
//
// if this is model run state
export const isRunState = (rst) => {
  if (!rst) return false
  return rst.hasOwnProperty('ModelName') && rst.hasOwnProperty('ModelDigest') &&
  rst.hasOwnProperty('RunStamp') && rst.hasOwnProperty('SubmitStamp') && rst.hasOwnProperty('IsFinal') &&
    rst.hasOwnProperty('RunName') && rst.hasOwnProperty('UpdateDateTime') && rst.hasOwnProperty('TaskRunName') &&
    rst.hasOwnProperty('IsLog') && rst.hasOwnProperty('LogFileName')
}

// if this is not empty model run state
export const isNotEmptyRunState = (rst) => {
  if (!isRunState(rst)) return false
  return (rst.ModelDigest || '') !== '' && (rst.UpdateDateTime || '') !== '' && ((rst.RunStamp || '') !== '' || (rst.SubmitStamp || '') !== '')
}

// return model run state
export const emptyRunState = () => {
  return {
    ModelName: '',
    ModelDigest: '',
    RunStamp: '',
    SubmitStamp: '',
    IsFinal: false,
    UpdateDateTime: '',
    RunName: '',
    TaskRunName: '',
    IsLog: false,
    LogFileName: ''
  }
}

// RunStateLogPage: RunState and log file page
//
// if this is RunStateLogPage: model run state and run log page
export const isRunStateLog = (rlp) => {
  if (!rlp) return false
  if (!isRunState(rlp)) return false
  return rlp.hasOwnProperty('Offset') && rlp.hasOwnProperty('Size') &&
    rlp.hasOwnProperty('TotalSize') && Array.isArray(rlp.Lines)
}

// if this is not empty RunStateLogPage: model run state and run log page
export const isNotEmptyRunStateLog = (rlp) => {
  return isNotEmptyRunState(rlp)
}

// return empty RunStateLogPage: model run state and run log page
export const emptyRunStateLog = () => {
  return {
    ModelName: '',
    ModelDigest: '',
    RunStamp: '',
    SubmitStamp: '',
    IsFinal: false,
    UpdateDateTime: '',
    RunName: '',
    TaskRunName: '',
    IsLog: false,
    LogFileName: '',
    Offset: 0,
    Size: 0,
    TotalSize: 0,
    Lines: []
  }
}

// return RunState part of RunStateLogPage
export const toRunStateFromLog = (rlp) => {
  if (!rlp) return emptyRunState()
  if (!isRunState(rlp)) return emptyRunState()
  return {
    ModelName: rlp.ModelName,
    ModelDigest: rlp.ModelDigest,
    RunStamp: rlp.RunStamp || '',
    SubmitStamp: rlp.SubmitStamp || '',
    IsFinal: !!rlp.IsFinal,
    RunName: rlp.RunName || '',
    TaskRunName: rlp.TaskRunName || '',
    UpdateDateTime: rlp.UpdateDateTime || '',
    IsLog: !!rlp.IsLog,
    LogFileName: rlp.LogFileName || ''
  }
}

// Run progerss: RunPub with run_lst row array of run_progress for each sub-value
//
// return true if each list element isRunStatusProgress()
export const isRunStatusProgressList = (rpl) => {
  if (!rpl) return false
  if (!Array.isArray(rpl)) return false
  for (let k = 0; k < rpl.length; k++) {
    if (!isRunStatusProgress(rpl[k])) return false
  }
  return true
}

// return empty run status and progress
export const emptyRunStatusProgress = () => {
  return {
    ModelName: '',
    ModelDigest: '',
    Name: '',
    RunDigest: '',
    ValueDigest: '',
    RunStamp: '',
    SubCount: 0,
    SubCompleted: 0,
    Status: '',
    CreateDateTime: '',
    UpdateDateTime: '',
    Progress: []
  }
}

// if this is run status and progress
export const isRunStatusProgress = (rp) => {
  if (!rp) return false
  if (!rp.hasOwnProperty('ModelName') || !rp.hasOwnProperty('ModelDigest')) return false
  if (!rp.hasOwnProperty('Name') || !rp.hasOwnProperty('RunDigest') || !rp.hasOwnProperty('ValueDigest') || !rp.hasOwnProperty('RunStamp')) return false
  if (!rp.hasOwnProperty('SubCount') || !rp.hasOwnProperty('SubCompleted')) return false
  if (!rp.hasOwnProperty('Status') || !rp.hasOwnProperty('CreateDateTime') || !rp.hasOwnProperty('UpdateDateTime')) return false
  if (!Array.isArray(rp.Progress)) return false
  return true
}

// if this is not empty run progress: model name, model digest, run name, run stamp, sub-count, status, create date-time
export const isNotEmptyRunStatusProgress = (rp) => {
  if (!isRunStatusProgress(rp)) return false
  return (rp.ModelName || '') !== '' && (rp.ModelDigest || '') !== '' &&
    (rp.Name || '') !== '' && (rp.RunDigest || '') !== '' && (rp.RunStamp || '') !== '' &&
    (rp.SubCount || 0) !== 0 && (rp.Status || '') !== '' && (rp.CreateDateTime || '') !== ''
}

// return empty run progress item
export const emptyRunProgress = () => {
  return {
    SubId: 0,
    Status: '',
    CreateDateTime: '',
    UpdateDateTime: '',
    Count: 0,
    Value: 0
  }
}

// if this is run progress item
export const isRunProgress = (rpi) => {
  if (!rpi) return false
  if (!rpi.hasOwnProperty('SubId') || !rpi.hasOwnProperty('Status')) return false
  if (!rpi.hasOwnProperty('CreateDateTime') || !rpi.hasOwnProperty('UpdateDateTime')) return false
  if (!rpi.hasOwnProperty('Count') || !rpi.hasOwnProperty('Value')) return false
  return true
}

// if this is not empty run progress item: status, create date-time, update date-time
export const isNotEmptyRunProgress = (rpi) => {
  if (!isRunProgress(rpi)) return false
  return (rpi.Status || '') !== '' && (rpi.CreateDateTime || '') !== '' && (rpi.UpdateDateTime || '') !== ''
}

// job control item
// for queue jobs RunStatus, LogFileName and log Lines are always empty
/*
{
  SubmitStamp: "2022_07_04_20_08_21_158",
  JobStatus: "",
  ModelName: "RiskPaths",
  ModelDigest: "d90e1e9a49a06d972ecf1d50e684c62b",
  RunStamp: "2022_07_04_20_08_21_159",
  Opts: {},
  Threads: 1,
  Mpi: {
    Np: 0
  },
  Template: "",
  Res: {
    Cpu: 1
  },
  RunNotes: [],
  Tables: [],
  LogFileName: "RiskPaths.2022_07_05_19_55_38_627.console.log",
  RunStatus: [],
  Lines: []
}
*/

// retrun empty job control item
export const emptyJobItem = (stamp) => {
  return {
    SubmitStamp: (!!stamp && typeof stamp === typeof 'string' && stamp !== '') ? stamp : 'none',
    JobStatus: '',
    ModelName: '',
    ModelDigest: '',
    RunStamp: '',
    Opts: {},
    RunNotes: [],
    Tables: [],
    Threads: 1,
    Mpi: { Np: 0 },
    Template: '',
    Res: { Cpu: 1 },
    IsOverLimit: false,
    QueuePos: 0,
    LogFileName: '',
    RunStatus: [],
    Lines: []
  }
}

// return true if this is job control state
export const isJobItem = (jc) => {
  if (!jc) return false
  if (!jc.hasOwnProperty('SubmitStamp') || typeof jc.SubmitStamp !== typeof 'string') {
    return false
  }
  if (!jc.hasOwnProperty('JobStatus') || !jc.hasOwnProperty('ModelName') || !jc.hasOwnProperty('ModelDigest') || !jc.hasOwnProperty('RunStamp') ||
    !jc.hasOwnProperty('Opts') || !jc.hasOwnProperty('RunNotes') || !jc.hasOwnProperty('Tables') ||
    !jc.hasOwnProperty('Threads') || !jc.hasOwnProperty('Mpi') || !jc.Mpi.hasOwnProperty('Np') || !jc.hasOwnProperty('Template') ||
    !jc.hasOwnProperty('Res') || !jc.Res.hasOwnProperty('Cpu') || !jc.hasOwnProperty('IsOverLimit') || !jc.hasOwnProperty('QueuePos')) {
    return false
  }
  if (!Array.isArray(jc.RunNotes) || !Array.isArray(jc.Tables)) {
    return false
  }
  if (typeof jc.Threads !== typeof 1 || typeof jc.Mpi.Np !== typeof 1 || typeof jc.Res.Cpu !== typeof 1 || typeof jc.QueuePos !== typeof 1) return false

  if (!jc.hasOwnProperty('LogFileName') || !jc.hasOwnProperty('RunStatus') || !jc.hasOwnProperty('Lines')) {
    return false
  }
  return Array.isArray(jc.RunStatus) && Array.isArray(jc.Lines)
}

// return true if this is not empty job control state
export const isNotEmptyJobItem = (jc) => {
  return isJobItem(jc) && typeof jc.ModelDigest === typeof 'string' && jc.ModelDigest !== ''
}

// retrun model run name or workset name from job run options: from Opts['OpenM.RunName']
export const getJobRunTitle = (jc) => {
  if (!jc) return ''
  if ((jc?.SubmitStamp || '') === '') return ''
  if (!jc.hasOwnProperty('Opts') || typeof jc.Opts !== 'object') return ''

  const runNameKey = 'OpenM.RunName'.toLowerCase()
  const wsNameKey = 'OpenM.SetName'.toLowerCase()
  let wsName = ''

  for (const key in jc.Opts) {
    if (!key || (jc.Opts[key] || '') === '') continue

    const v = jc.Opts[key]

    const klc = key.toLowerCase()
    if (klc.endsWith(runNameKey)) return v
    if (klc.endsWith(wsNameKey)) wsName = v
  }

  return wsName // run name not found: retrun workset name
}
