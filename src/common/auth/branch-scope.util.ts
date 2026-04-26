import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type BranchScopedUser = {
  userId?: string;
  branchId?: string | null;
  activeBranchId?: string | null;
  allowedBranchIds?: string[];
  hasAllBranchAccess?: boolean;
  permissions?: string[];
};

type BranchScopeOptions = {
  requestedBranchId?: string;
  allowGlobal?: boolean;
  globalPermissions?: string[];
  requireActiveBranch?: boolean;
  missingActiveBranchMessage?: string;
  forbiddenMessage?: string;
};

const getActiveBranchId = (user: BranchScopedUser) =>
  user?.activeBranchId || user?.branchId || null;

const getAllowedBranchIds = (user: BranchScopedUser) =>
  user?.allowedBranchIds || [];

const hasGlobalScope = (
  user: BranchScopedUser,
  globalPermissions: string[] = []
) => {
  if (user?.hasAllBranchAccess) {
    return true;
  }

  const permissions = user?.permissions || [];
  return globalPermissions.some((permission) =>
    permissions.includes(permission)
  );
};

export const ensureBranchAccess = (
  user: BranchScopedUser,
  branchId?: string | null,
  forbiddenMessage = 'No tienes acceso a la sucursal solicitada',
  globalPermissions: string[] = []
) => {
  if (!branchId) {
    return;
  }

  if (hasGlobalScope(user, globalPermissions)) {
    return;
  }

  const activeBranchId = getActiveBranchId(user);
  const allowedBranchIds = getAllowedBranchIds(user);

  if (activeBranchId === branchId || allowedBranchIds.includes(branchId)) {
    return;
  }

  throw new ForbiddenException(forbiddenMessage);
};

export const resolveBranchScope = (
  user: BranchScopedUser,
  options: BranchScopeOptions = {}
) => {
  const {
    requestedBranchId,
    allowGlobal = false,
    globalPermissions = [],
    requireActiveBranch = true,
    missingActiveBranchMessage = 'No hay una sucursal activa definida',
    forbiddenMessage = 'No tienes acceso a la sucursal solicitada'
  } = options;

  if (requestedBranchId) {
    ensureBranchAccess(
      user,
      requestedBranchId,
      forbiddenMessage,
      globalPermissions
    );
    return requestedBranchId;
  }

  if (allowGlobal && hasGlobalScope(user, globalPermissions)) {
    return undefined;
  }

  const activeBranchId = getActiveBranchId(user);

  if (!activeBranchId) {
    if (requireActiveBranch) {
      throw new BadRequestException(missingActiveBranchMessage);
    }

    return undefined;
  }

  ensureBranchAccess(user, activeBranchId, forbiddenMessage, globalPermissions);
  return activeBranchId;
};
