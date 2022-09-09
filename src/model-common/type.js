// db structures common functions: model type, type list, enum, enum list

import * as Mdl from './model'
import * as Dnf from './descr-note'
import * as Hlpr from './helper'

// is model has type text list and each element is TypeTxt
export const isTypeTextList = (md) => {
  if (!Mdl.isModel(md)) return false
  if (!Array.isArray(md.TypeTxt)) return false
  for (let k = 0; k < md.TypeTxt.length; k++) {
    if (!isType(md.TypeTxt[k].Type)) return false
  }
  return true
}

// return true if this is non empty Type
export const isType = (t) => {
  if (!t) return false
  if (!t.hasOwnProperty('TypeId') || !t.hasOwnProperty('Name') || !t.hasOwnProperty('Digest') || !t.hasOwnProperty('DicId')) return false
  return (t.Name || '') !== '' && (t.Digest || '') !== ''
}

// return empty TypeTxt
export const emptyTypeText = () => {
  return {
    Type: {
      TypeId: 0,
      Name: '',
      Digest: '',
      DicId: 0
    },
    DescrNote: {
      LangCode: '',
      Descr: '',
      Note: ''
    },
    TypeEnumTxt: []
  }
}

// find TypeTxt by TypeId
export const typeTextById = (md, typeId) => {
  if (!Mdl.isModel(md) || typeId === void 0 || typeId === null) { // model empty or type id empty: return empty result
    return emptyTypeText()
  }
  for (let k = 0; k < md.TypeTxt.length; k++) {
    if (!isType(md.TypeTxt[k].Type)) continue
    if (md.TypeTxt[k].Type.TypeId === typeId) return md.TypeTxt[k]
  }
  return emptyTypeText() // not found
}

// built-in types
/*
  1 = char
  2 = schar
  3 = short
  4 = int
  5 = long
  6 = llong
  7 = bool
  8 = uchar
  9 = ushort
  10 = uint
  11 = ulong
  12 = ullong
  13 = float
  14 = double
  15 = ldouble
  16 = Time
  17 = real
  18 = integer
  19 = counter
  20 = big_counter
  21 = file
*/
// max type id for built-in types
export const OM_MAX_BUILTIN_TYPE_ID = 100

const OM_INT_TYPE_ID = 4 // type id of built-in int type

// return true if model type is built-in
export const isBuiltIn = (t) => {
  return isType(t) && t.TypeId <= OM_MAX_BUILTIN_TYPE_ID
}

// return true if model type is boolean (logical)
export const isBool = (t) => {
  if (!isBuiltIn(t)) return false
  return t.Name.toLowerCase() === 'bool'
}

// return true if model type is string
export const isString = (t) => {
  if (!isBuiltIn(t)) return false
  return t.Name.toLowerCase() === 'file'
}

// return true if model type is float
export const isFloat = (t) => {
  if (!isBuiltIn(t)) return false
  const name = t.Name.toLowerCase()
  return name === 'float' || name === 'double' || name === 'ldouble' || name === 'time' || name === 'real'
}

// return true if model type is integer
export const isInt = (t) => {
  if (!isBuiltIn(t)) return false
  return !isBool(t) && !isString(t) && !isFloat(t)
}

// return TypeTxt for built-in int type
export const intTypeText = (md) => {
  if (Mdl.isModel(md)) { // if model not empty then search for int type
    for (let k = 0; k < md.TypeTxt.length; k++) {
      if (!isBuiltIn(md.TypeTxt[k].Type)) continue
      if (md.TypeTxt[k].Type.Name.toLowerCase() === 'int') return md.TypeTxt[k]
    }
  }
  // if not found then return default TypeTxt for int type
  return {
    Type: {
      TypeId: OM_INT_TYPE_ID,
      Name: 'int',
      Digest: '_int_',
      DicId: 0,
      TotalEnumId: 1
    },
    DescrNote: {
      LangCode: '',
      Descr: '',
      Note: ''
    },
    TypeEnumTxt: []
  }
}

// enum is array of TypeEnumTxt[]
// each TypeEnumTxt[i] must have:
//  .Enum: {EnumId: 0, Name: 'uniqueCode'} and optional .DescrNote: {Descr: 'Some Label', Note: 'It can be long notes'}

// find type size by TypeId: TypeTxt.TypeEnumTxt.length
export const typeEnumSizeById = (md, typeId) => {
  const t = typeTextById(md, typeId)
  if (!isType(t.Type)) return 0
  if (!t.hasOwnProperty('TypeEnumTxt')) return 0
  return t.TypeEnumTxt.length || 0
}

// return true if this is non empty Enum
export const isEnum = (t) => {
  if (!t || !t.Enum) return false
  return !(t.Enum.EnumId === void 0 || t.Enum.EnumId === null || !t.Enum.Name)
}

// find enum code by enum id or empty string if not found
export const enumCodeById = (typeTxt, enumId) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return ''
  for (let k = 0; k < typeTxt.TypeEnumTxt.length; k++) {
    if (isEnum(typeTxt.TypeEnumTxt[k]) && typeTxt.TypeEnumTxt[k].Enum.EnumId === enumId) {
      return (typeTxt.TypeEnumTxt[k].Enum.Name || '')
    }
  }
  return '' // not found
}

// return array of enum Ids by array of codes
export const codeArrayToEnumIdArray = (typeTxt, codeArr) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt')) return []

  const cLen = Hlpr.lengthOf(codeArr)
  const tLen = Hlpr.lengthOf(typeTxt.TypeEnumTxt)
  if (tLen <= 0 || cLen <= 0) return []

  const eArr = Array(cLen)
  let n = 0
  for (let k = 0; k < tLen; k++) {
    if (codeArr.findIndex(c => c === typeTxt.TypeEnumTxt[k].Enum.Name) >= 0) {
      eArr[n++] = typeTxt.TypeEnumTxt[k].Enum.EnumId
    }
  }
  eArr.length = n // remove size of not found
  return eArr
}

// return array of codes by array of enum Ids
export const enumIdArrayToCodeArray = (typeTxt, enumIdArr) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt')) return []

  const eLen = Hlpr.lengthOf(enumIdArr)
  const tLen = Hlpr.lengthOf(typeTxt.TypeEnumTxt)
  if (tLen <= 0 || eLen <= 0) return []

  const cArr = Array(eLen)
  let n = 0
  for (let k = 0; k < tLen; k++) {
    if (enumIdArr.findIndex(eId => eId === typeTxt.TypeEnumTxt[k].Enum.EnumId) >= 0) {
      cArr[n++] = typeTxt.TypeEnumTxt[k].Enum.Name || ''
    }
  }
  cArr.length = n // remove size of not found
  return cArr
}

// find enum description or code by enum id or empty string if not found
export const enumDescrOrCodeById = (typeTxt, enumId) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return ''
  for (let k = 0; k < typeTxt.TypeEnumTxt.length; k++) {
    if (isEnum(typeTxt.TypeEnumTxt[k]) && typeTxt.TypeEnumTxt[k].Enum.EnumId === enumId) {
      return Dnf.descrOfDescrNote(typeTxt.TypeEnumTxt[k]) || (typeTxt.TypeEnumTxt[k].Enum.Name || '')
    }
  }
  return '' // not found
}

// find enum id by description or code return null if not found
export const enumIdByDescrOrCode = (typeTxt, enumDc) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return null
  for (let k = 0; k < typeTxt.TypeEnumTxt.length; k++) {
    if (isEnum(typeTxt.TypeEnumTxt[k])) {
      const dc = Dnf.descrOfDescrNote(typeTxt.TypeEnumTxt[k]) || (typeTxt.TypeEnumTxt[k].Enum.Name || '')
      if (dc === enumDc) return typeTxt.TypeEnumTxt[k].Enum.EnumId
    }
  }
  return null // not found
}

// return enum by index, return null if index out of range
export const enumByIdx = (typeTxt, idx) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return null
  if (idx < 0 || idx >= typeTxt.TypeEnumTxt.length) return null

  return isEnum(typeTxt.TypeEnumTxt[idx]) ? typeTxt.TypeEnumTxt[idx].Enum : null
}

// return array of all codes from TypeEnumTxt[]
export const enumCodeArray = (typeTxt) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return []
  const codeArr = []
  for (let k = 0; k < typeTxt.TypeEnumTxt.length; k++) {
    if (!isEnum(typeTxt.TypeEnumTxt[k])) {
      codeArr.push('')
    } else {
      codeArr.push((typeTxt.TypeEnumTxt[k].Enum.Name || ''))
    }
  }
  return codeArr
}

// return array of all description or code from TypeEnumTxt[]
export const enumDescrOrCodeArray = (typeTxt) => {
  if (!typeTxt || !typeTxt.hasOwnProperty('TypeEnumTxt') || !Hlpr.isLength(typeTxt.TypeEnumTxt)) return []
  const dcArr = []
  for (let k = 0; k < typeTxt.TypeEnumTxt.length; k++) {
    if (!isEnum(typeTxt.TypeEnumTxt[k])) {
      dcArr.push('')
    } else {
      dcArr.push((Dnf.descrOfDescrNote(typeTxt.TypeEnumTxt[k]) || (typeTxt.TypeEnumTxt[k].Enum.Name || '')))
    }
  }
  return dcArr
}
