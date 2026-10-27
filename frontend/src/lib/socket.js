import { io } from 'socket.io-client'

let socket = null

// One shared connection for the whole app. It is only opened once someone is logged in,
// because the server refuses sockets without a login.
export const getSocket = () => {
  if (!socket) socket = io({ withCredentials: true })
  return socket
}

// Called on login and logout so the next connection uses the new cookie
export const resetSocket = () => {
  if (socket) socket.disconnect()
  socket = null
}
