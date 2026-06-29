import { supabase } from './supabase'

// Ejemplo: Obtener todos los registros de una tabla
export const getAllRecords = async (tableName: string) => {
  const { data, error } = await supabase.from(tableName).select('*')
  return { data, error }
}

// Ejemplo: Obtener un registro por ID
export const getRecordById = async (tableName: string, id: string) => {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
}

// Ejemplo: Insertar un nuevo registro
export const insertRecord = async (tableName: string, record: Record<string, any>) => {
  const { data, error } = await supabase.from(tableName).insert([record])
  return { data, error }
}

// Ejemplo: Actualizar un registro
export const updateRecord = async (
  tableName: string,
  id: string,
  updates: Record<string, any>
) => {
  const { data, error } = await supabase
    .from(tableName)
    .update(updates)
    .eq('id', id)
  return { data, error }
}

// Ejemplo: Eliminar un registro
export const deleteRecord = async (tableName: string, id: string) => {
  const { data, error } = await supabase.from(tableName).delete().eq('id', id)
  return { data, error }
}

// Ejemplo: Autenticación - Registro
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

// Ejemplo: Autenticación - Login
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

// Ejemplo: Obtener sesión actual
export const getCurrentSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}

// Ejemplo: Logout
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}
