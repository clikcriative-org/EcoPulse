export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PASTOR = 'PASTOR',
  ADMIN = 'ADMIN',
  LEADER = 'LEADER',
  VOLUNTEER = 'VOLUNTEER',
  MEMBER = 'MEMBER',
}

export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TRANSFERRED = 'TRANSFERRED',
  DECEASED = 'DECEASED',
}

export enum VisitorStatus {
  NEW = 'NEW',
  RETURNING = 'RETURNING',
  REGULAR = 'REGULAR',
  FAITHFUL = 'FAITHFUL',
  INACTIVE = 'INACTIVE',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  NOT_INFORMED = 'NOT_INFORMED',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
  NOT_INFORMED = 'NOT_INFORMED',
}

export enum DonationType {
  TITHE = 'TITHE',
  OFFERING = 'OFFERING',
  CAMPAIGN = 'CAMPAIGN',
  SPECIAL = 'SPECIAL',
}

export enum PaymentMethod {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}
