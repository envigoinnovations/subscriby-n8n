import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { memberPassApiRequest, compactBody } from './GenericFunctions';

/**
 * Primary action node — exposes every write + search route documented at
 * https://docs.memberpass.net/api. Triggers live in MemberPassTrigger.
 *
 * Convention mirrors the MemberPass REST surface: (resource, operation)
 * maps 1:1 to a single route.
 */
export class MemberPass implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MemberPass',
    name: 'memberPass',
    icon: 'file:memberpass.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Manage MemberPass projects, plans, subscriptions, and members.',
    defaults: {
      name: 'MemberPass',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'memberPassApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Access Code', value: 'accessCode' },
          { name: 'Member', value: 'member' },
          { name: 'Plan', value: 'plan' },
          { name: 'Project', value: 'project' },
          { name: 'Resource', value: 'resource' },
          { name: 'Subscriber', value: 'subscriber' },
          { name: 'Subscription', value: 'subscription' },
        ],
        default: 'project',
      },

      // === PROJECT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['project'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a project', description: 'Create a new project' },
          { name: 'Update', value: 'update', action: 'Update a project', description: 'Update an existing project' },
          { name: 'Archive', value: 'archive', action: 'Archive a project', description: 'Soft-delete a project' },
          { name: 'Restore', value: 'restore', action: 'Restore a project', description: 'Restore an archived project' },
          { name: 'Find by Handle', value: 'findByHandle', action: 'Find a project by handle', description: 'Return the first project whose handle matches' },
        ],
        default: 'create',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['create'] } },
        description: 'Display name for the new project',
      },
      {
        displayName: 'Handle',
        name: 'handle',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['create', 'findByHandle'] } },
        description: 'URL-safe handle (lowercase letters, numbers, hyphens)',
      },
      {
        displayName: 'Platform',
        name: 'platform',
        type: 'options',
        options: [
          { name: 'Telegram', value: 'telegram' },
        ],
        default: 'telegram',
        displayOptions: { show: { resource: ['project'], operation: ['create'] } },
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['project'], operation: ['update', 'archive', 'restore'] } },
        description: 'UUID of the project',
      },
      {
        displayName: 'Fields to Update',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['project'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Description', name: 'description', type: 'string', default: '', typeOptions: { rows: 3 } },
          { displayName: 'Website URL', name: 'website_url', type: 'string', default: '' },
        ],
      },

      // === PLAN ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['plan'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a plan', description: 'Create a subscription plan under a project' },
          { name: 'Update', value: 'update', action: 'Update a plan', description: 'Update plan attributes' },
          { name: 'Publish', value: 'publish', action: 'Publish a plan', description: 'Make a plan publicly purchasable' },
          { name: 'Unpublish', value: 'unpublish', action: 'Unpublish a plan', description: 'Hide a plan from purchase' },
          { name: 'Get', value: 'get', action: 'Get a plan', description: 'Fetch a plan by UUID' },
          { name: 'Find by Name', value: 'findByName', action: 'Find a plan by name', description: 'Return the first plan whose name matches' },
        ],
        default: 'create',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'] } },
      },
      {
        displayName: 'Plan ID',
        name: 'planId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['update', 'publish', 'unpublish', 'get'] } },
      },
      {
        displayName: 'Plan Name',
        name: 'planName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['findByName'] } },
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
      },
      {
        displayName: 'Price',
        name: 'price',
        type: 'number',
        typeOptions: { minValue: 0 },
        default: 0,
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Price in the smallest currency unit (e.g., cents)',
      },
      {
        displayName: 'Currency',
        name: 'currency',
        type: 'string',
        default: 'USD',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'ISO 4217 currency code',
      },
      {
        displayName: 'Billing Cycle',
        name: 'billingCycle',
        type: 'options',
        options: [
          { name: 'Monthly', value: 'monthly' },
          { name: 'Yearly', value: 'yearly' },
          { name: 'One-Time', value: 'one_time' },
        ],
        default: 'monthly',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
      },
      {
        displayName: 'Fields to Update',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Description', name: 'description', type: 'string', default: '', typeOptions: { rows: 3 } },
          { displayName: 'Price', name: 'price', type: 'number', default: 0 },
          { displayName: 'Trial Days', name: 'trial_days', type: 'number', default: 0 },
        ],
      },

      // === SUBSCRIPTION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['subscription'] } },
        options: [
          { name: 'Cancel', value: 'cancel', action: 'Cancel a subscription', description: 'Cancel a subscription immediately or at period end' },
          { name: 'Get', value: 'get', action: 'Get a subscription', description: 'Fetch a subscription by UUID' },
        ],
        default: 'cancel',
      },
      {
        displayName: 'Subscription ID',
        name: 'subscriptionId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscription'] } },
      },
      {
        displayName: 'Cancel at Period End',
        name: 'atPeriodEnd',
        type: 'boolean',
        default: true,
        displayOptions: { show: { resource: ['subscription'], operation: ['cancel'] } },
        description: 'Whether to let the subscription run until its current period ends. Off = cancel immediately',
      },

      // === MEMBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['member'] } },
        options: [
          { name: 'Ban', value: 'ban', action: 'Ban a member', description: 'Ban a member from the project community' },
          { name: 'Unban', value: 'unban', action: 'Unban a member', description: 'Lift a previous ban' },
          { name: 'Kick', value: 'kick', action: 'Kick a member', description: 'Remove a member without a permanent ban' },
          { name: 'Get', value: 'get', action: 'Get a member', description: 'Fetch a member by UUID' },
        ],
        default: 'ban',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['member'] } },
      },
      {
        displayName: 'Member ID',
        name: 'memberId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['member'] } },
      },
      {
        displayName: 'Reason',
        name: 'reason',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['member'], operation: ['ban', 'kick'] } },
        description: 'Optional moderator note recorded with the action',
      },

      // === SUBSCRIBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['subscriber'] } },
        options: [
          { name: 'Find by Telegram ID', value: 'findByTelegramId', action: 'Find a subscriber by Telegram ID', description: 'Return the subscriber whose Telegram user id matches' },
        ],
        default: 'findByTelegramId',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscriber'] } },
      },
      {
        displayName: 'Telegram ID',
        name: 'telegramId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscriber'], operation: ['findByTelegramId'] } },
        description: 'Numeric Telegram user ID (the value Telegram hands to bots)',
      },

      // === ACCESS CODE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['accessCode'] } },
        options: [
          { name: 'Bulk Generate', value: 'bulkGenerate', action: 'Bulk generate access codes', description: 'Generate a batch of single-use access codes for a plan' },
        ],
        default: 'bulkGenerate',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'] } },
      },
      {
        displayName: 'Plan ID',
        name: 'planId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'] } },
      },
      {
        displayName: 'Quantity',
        name: 'quantity',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 1000 },
        default: 10,
        required: true,
        displayOptions: { show: { resource: ['accessCode'], operation: ['bulkGenerate'] } },
      },
      {
        displayName: 'Expires In Days',
        name: 'expiresInDays',
        type: 'number',
        typeOptions: { minValue: 1 },
        default: 30,
        displayOptions: { show: { resource: ['accessCode'], operation: ['bulkGenerate'] } },
        description: 'Days until the generated codes expire if unused',
      },

      // === RESOURCE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['resource'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a resource', description: 'Attach an external deliverable to a project' },
        ],
        default: 'create',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'] } },
      },
      {
        displayName: 'Title',
        name: 'title',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
      },
      {
        displayName: 'Type',
        name: 'type',
        type: 'options',
        options: [
          { name: 'Telegram Chat', value: 'telegram_chat' },
          { name: 'Telegram Channel', value: 'telegram_channel' },
          { name: 'Link', value: 'link' },
        ],
        default: 'telegram_chat',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
      },
      {
        displayName: 'Target',
        name: 'target',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['create'] } },
        description: 'Chat ID, channel username, or URL — depending on the resource type',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;

        const response = await dispatch.call(this, resource, operation, i);
        const payload = extractData(response);

        if (Array.isArray(payload)) {
          for (const row of payload) {
            returnData.push({ json: row as IDataObject, pairedItem: { item: i } });
          }
        } else {
          returnData.push({ json: payload, pairedItem: { item: i } });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

async function dispatch(
  this: IExecuteFunctions,
  resource: string,
  operation: string,
  i: number,
): Promise<IDataObject> {
  switch (resource) {
    case 'project':
      return dispatchProject.call(this, operation, i);
    case 'plan':
      return dispatchPlan.call(this, operation, i);
    case 'subscription':
      return dispatchSubscription.call(this, operation, i);
    case 'member':
      return dispatchMember.call(this, operation, i);
    case 'subscriber':
      return dispatchSubscriber.call(this, operation, i);
    case 'accessCode':
      return dispatchAccessCode.call(this, operation, i);
    case 'resource':
      return dispatchResource.call(this, operation, i);
    default:
      throw new Error(`Unknown resource: ${resource}`);
  }
}

async function dispatchProject(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'create') {
    const body = compactBody({
      name: this.getNodeParameter('name', i) as string,
      handle: this.getNodeParameter('handle', i) as string,
      platform: this.getNodeParameter('platform', i) as string,
    });
    return memberPassApiRequest.call(this, 'POST', '/projects', body);
  }

  if (operation === 'update') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
    return memberPassApiRequest.call(this, 'PATCH', `/projects/${projectId}`, compactBody(updateFields));
  }

  if (operation === 'archive') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return memberPassApiRequest.call(this, 'POST', `/projects/${projectId}/archive`);
  }

  if (operation === 'restore') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return memberPassApiRequest.call(this, 'POST', `/projects/${projectId}/restore`);
  }

  if (operation === 'findByHandle') {
    const handle = this.getNodeParameter('handle', i) as string;
    return memberPassApiRequest.call(this, 'GET', '/projects', undefined, { handle });
  }

  throw new Error(`Unknown project operation: ${operation}`);
}

async function dispatchPlan(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'create') {
    const body = compactBody({
      name: this.getNodeParameter('name', i) as string,
      price: this.getNodeParameter('price', i) as number,
      currency: this.getNodeParameter('currency', i) as string,
      billing_cycle: this.getNodeParameter('billingCycle', i) as string,
    });
    return memberPassApiRequest.call(this, 'POST', `/projects/${projectId}/plans`, body);
  }

  if (operation === 'update') {
    const planId = this.getNodeParameter('planId', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
    return memberPassApiRequest.call(
      this,
      'PATCH',
      `/projects/${projectId}/plans/${planId}`,
      compactBody(updateFields),
    );
  }

  if (operation === 'publish' || operation === 'unpublish') {
    const planId = this.getNodeParameter('planId', i) as string;
    return memberPassApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/${operation}`,
    );
  }

  if (operation === 'get') {
    const planId = this.getNodeParameter('planId', i) as string;
    return memberPassApiRequest.call(this, 'GET', `/projects/${projectId}/plans/${planId}`);
  }

  if (operation === 'findByName') {
    const planName = this.getNodeParameter('planName', i) as string;
    return memberPassApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans`,
      undefined,
      { name: planName },
    );
  }

  throw new Error(`Unknown plan operation: ${operation}`);
}

async function dispatchSubscription(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;

  if (operation === 'cancel') {
    const atPeriodEnd = this.getNodeParameter('atPeriodEnd', i) as boolean;
    return memberPassApiRequest.call(
      this,
      'POST',
      `/subscriptions/${subscriptionId}/cancel`,
      { at_period_end: atPeriodEnd },
    );
  }

  if (operation === 'get') {
    return memberPassApiRequest.call(this, 'GET', `/subscriptions/${subscriptionId}`);
  }

  throw new Error(`Unknown subscription operation: ${operation}`);
}

async function dispatchMember(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;
  const memberId = this.getNodeParameter('memberId', i) as string;

  if (operation === 'ban' || operation === 'kick') {
    const reason = this.getNodeParameter('reason', i, '') as string;
    return memberPassApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/${operation}`,
      compactBody({ reason }),
    );
  }

  if (operation === 'unban') {
    return memberPassApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/unban`,
    );
  }

  if (operation === 'get') {
    return memberPassApiRequest.call(this, 'GET', `/projects/${projectId}/members/${memberId}`);
  }

  throw new Error(`Unknown member operation: ${operation}`);
}

async function dispatchSubscriber(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'findByTelegramId') {
    const telegramId = this.getNodeParameter('telegramId', i) as string;
    return memberPassApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/members`,
      undefined,
      { telegram_id: telegramId },
    );
  }

  throw new Error(`Unknown subscriber operation: ${operation}`);
}

async function dispatchAccessCode(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;
  const planId = this.getNodeParameter('planId', i) as string;

  if (operation === 'bulkGenerate') {
    const quantity = this.getNodeParameter('quantity', i) as number;
    const expiresInDays = this.getNodeParameter('expiresInDays', i, 0) as number;

    const body: IDataObject = { quantity };
    if (expiresInDays > 0) {
      body.expires_in_days = expiresInDays;
    }

    return memberPassApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/access-codes/bulk-generate`,
      body,
    );
  }

  throw new Error(`Unknown access code operation: ${operation}`);
}

async function dispatchResource(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'create') {
    const body = compactBody({
      title: this.getNodeParameter('title', i) as string,
      type: this.getNodeParameter('type', i) as string,
      target: this.getNodeParameter('target', i) as string,
    });
    return memberPassApiRequest.call(this, 'POST', `/projects/${projectId}/resources`, body);
  }

  throw new Error(`Unknown resource operation: ${operation}`);
}

function extractData(response: IDataObject): IDataObject | IDataObject[] {
  if (response === null || response === undefined) {
    return {};
  }

  const data = (response as { data?: unknown }).data;

  if (Array.isArray(data)) {
    return data as IDataObject[];
  }

  if (data !== undefined && data !== null) {
    return data as IDataObject;
  }

  return response;
}
