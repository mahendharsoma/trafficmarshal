import { NextResponse } from 'next/server';
import { handleTrafficMarshalModel } from '../models/TrafficMarshalModel';

const AUTH_STRICT = process.env.API_AUTH_STRICT === 'true';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getPathParts(request) {
  const { pathname } = new URL(request.url);
  return pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

function isPublicRoute(parts, method) {
  if (parts.length === 0) return true;
  if (method === 'POST' && parts[0] === 'auth' && parts[1] === 'login') return true;
  if (method === 'POST' && parts[0] === 'seed') return true;
  return false;
}

function getActorFromHeaders(request) {
  const id = request.headers.get('x-user-id') || null;
  const role = request.headers.get('x-user-role') || null;
  const name = request.headers.get('x-user-name') || null;
  return { id, role, name };
}

function roleAllowed(parts, actor) {
  const role = actor.role;
  if (!role) return false;

  if (parts[0] === 'admin') {
    return role === 'super_admin';
  }

  if (parts[0] === 'dcp') {
    if (!['dcp', 'super_admin'].includes(role)) return false;
    if (role === 'super_admin') return true;
    return !parts[1] || parts[1] === actor.id;
  }

  if (parts[0] === 'sho') {
    if (!['sho', 'super_admin'].includes(role)) return false;
    if (role === 'super_admin') return true;
    return !parts[1] || parts[1] === actor.id;
  }

  return true;
}

export async function handleTrafficMarshalController(request) {
  const parts = getPathParts(request);
  const method = request.method;

  if (!AUTH_STRICT || isPublicRoute(parts, method)) {
    return handleTrafficMarshalModel(request);
  }

  const actor = getActorFromHeaders(request);
  if (!actor.id || !actor.role) {
    return jsonError('Unauthorized. Send x-user-id and x-user-role headers.', 401);
  }

  if (!roleAllowed(parts, actor)) {
    return jsonError('Forbidden: role does not have access to this route.', 403);
  }

  return handleTrafficMarshalModel(request);
}
