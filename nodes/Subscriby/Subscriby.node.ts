import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
  subscribyApiRequest,
  subscribyApiRequestAllItems,
  compactBody,
  toNodeError,
} from './GenericFunctions';

/**
 * Primary action node — exposes every write + search route documented at
 * https://docs.subscriby.net/api. Triggers live in SubscribyTrigger.
 *
 * Convention mirrors the Subscriby REST surface: (resource, operation)
 * maps 1:1 to a single route.
 */
export class Subscriby implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Subscriby',
    name: 'subscriby',
    icon: { light: 'file:subscriby.svg', dark: 'file:subscriby.dark.svg' },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Manage Subscriby projects, plans, subscriptions, and members.',
    defaults: {
      name: 'Subscriby',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [
      {
        name: 'subscribyApi',
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
          { name: 'Activity', value: 'activity' },
          { name: 'Analytics', value: 'analytics' },
          { name: 'Bot', value: 'bot' },
          { name: 'Distribution', value: 'distribution' },
          { name: 'Group', value: 'group' },
          { name: 'Member', value: 'member' },
          { name: 'Pass Window', value: 'passWindow' },
          { name: 'Payment Method', value: 'paymentMethod' },
          { name: 'Plan', value: 'plan' },
          { name: 'Project', value: 'project' },
          { name: 'Resource', value: 'resource' },
          { name: 'Role', value: 'role' },
          { name: 'Subscriber', value: 'subscriber' },
          { name: 'Subscription', value: 'subscription' },
          { name: 'Support Conversation', value: 'supportConversation' },
          { name: 'Team', value: 'team' },
          { name: 'Team Member', value: 'teamMember' },
          { name: 'Token', value: 'token' },
          { name: 'Webhook Delivery', value: 'webhookDelivery' },
          { name: 'Webhook Endpoint', value: 'webhookEndpoint' },
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
          { name: 'Archive', value: 'archive', action: 'Archive a project', description: 'Soft-delete a project' },
          { name: 'Create', value: 'create', action: 'Create a project', description: 'Create a new project' },
          { name: 'Delete', value: 'delete', action: 'Delete a project', description: 'Permanently delete a project' },
          { name: 'Find by Handle', value: 'findByHandle', action: 'Find a project by handle', description: 'Return the first project whose handle matches' },
          { name: 'Get', value: 'get', action: 'Get a project', description: 'Fetch a project by UUID' },
          { name: 'List', value: 'list', action: 'List projects', description: 'List all projects visible to the current team' },
          { name: 'Restore', value: 'restore', action: 'Restore a project', description: 'Restore an archived project' },
          { name: 'Update', value: 'update', action: 'Update a project', description: 'Update an existing project' },
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
        displayOptions: { show: { resource: ['project'], operation: ['update', 'archive', 'restore', 'delete', 'get'] } },
        description: 'UUID of the project',
      },
      {
        displayName: 'Update Fields',
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

      // === PASS WINDOW ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['passWindow'] } },
        options: [
          { name: 'List', value: 'list', action: 'List pass windows', description: "List the dated access windows a project's pass plans generate, with their IDs" },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['passWindow'] } },
      },
      {
        displayName: 'Filters',
        name: 'filters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['passWindow'], operation: ['list'] } },
        options: [
          { displayName: 'On Sale Only', name: 'sellable_only', type: 'boolean', default: false, description: "Whether to return only windows a customer can buy right now, after the plan's sales cutoff. Not the same as Status." },
          { displayName: 'Pass Plan ID', name: 'plan_id', type: 'string', default: '', description: 'Narrow to one pass plan. Omit for every pass plan on the project.' },
          { displayName: 'Starting After', name: 'from', type: 'dateTime', default: '' },
          { displayName: 'Starting Before', name: 'to', type: 'dateTime', default: '' },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'Canceled', value: 'canceled' },
              { name: 'Closed', value: 'closed', description: 'Finished' },
              { name: 'Open', value: 'open', description: 'Running now' },
              { name: 'Scheduled', value: 'scheduled', description: 'Not yet open' },
            ],
            default: 'scheduled',
          },
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
          { name: 'Delete', value: 'delete', action: 'Delete a plan', description: 'Permanently delete a plan' },
          { name: 'Find by Name', value: 'findByName', action: 'Find a plan by name', description: 'Return the first plan whose name matches' },
          { name: 'Get', value: 'get', action: 'Get a plan', description: 'Fetch a plan by UUID' },
          { name: 'List', value: 'list', action: 'List plans', description: 'List all plans under a project' },
          { name: 'Publish', value: 'publish', action: 'Publish a plan', description: 'Make a plan publicly purchasable' },
          { name: 'Unpublish', value: 'unpublish', action: 'Unpublish a plan', description: 'Hide a plan from purchase' },
          { name: 'Update', value: 'update', action: 'Update a plan', description: 'Update plan attributes' },
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
        displayOptions: { show: { resource: ['plan'], operation: ['update', 'publish', 'unpublish', 'get', 'delete'] } },
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
        description: '5-255 characters, unique within the project',
      },
      {
        displayName: 'Plan Kind',
        name: 'kind',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Recurring Subscription', value: 'subscription', description: 'Access starts at payment and renews on a cycle' },
          { name: 'Time-Limited Pass', value: 'pass', description: 'One dated access window per purchase' },
          { name: 'Pass Series', value: 'pass_series', description: "A season ticket over many of your pass plans' windows" },
        ],
        default: 'subscription',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'] } },
        description: 'Decides which fields apply below. The API refuses a block belonging to another kind, so this must match the plan.',
      },
      {
        displayName: 'Currency Name or ID',
        name: 'currencyId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'UUID from /v1/currencies. Must be supported by an active payment method on the project.',
      },
      {
        displayName: 'Price',
        name: 'price',
        type: 'number',
        typeOptions: { minValue: 0, numberPrecision: 2 },
        default: 0,
        required: true,
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Decimal, not cents. On a pass this buys one window; on a pass series it buys the whole slate, once.',
      },
      {
        displayName: 'Resource Names or IDs',
        name: 'resources',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['plan'], operation: ['create'] } },
        description: 'Comma-separated project resource UUIDs. Required on Recurring Subscription and Time-Limited Pass — a plan with no linked resource cannot be redeemed. Optional on Pass Series, where it means a lounge the holder keeps for the whole span.',
      },

      // --- kind: subscription ---
      {
        displayName: 'Billing',
        name: 'billing',
        type: 'collection',
        placeholder: 'Add Billing Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['subscription'] } },
        options: [
          {
            displayName: 'Billing Cycle',
            name: 'billing_cycle',
            type: 'options',
            options: [
              { name: 'Day', value: 'day' },
              { name: 'Lifetime', value: 'lifetime' },
              { name: 'Month', value: 'month' },
              { name: 'Week', value: 'week' },
              { name: 'Year', value: 'year' },
            ],
            default: 'month',
          },
          { displayName: 'Cardless Trial', name: 'trial_cardless', type: 'boolean', default: false, description: 'Whether the trial can start without a payment method on file' },
          { displayName: 'Cycle Count', name: 'billing_cycle_count', type: 'number', typeOptions: { minValue: 1, maxValue: 99 }, default: 1, description: 'Must be 1 when Billing Cycle is Lifetime' },
          { displayName: 'Disabled Renewal', name: 'disabled_renewal', type: 'boolean', default: false, description: 'Whether to charge once and then lapse rather than renewing' },
          { displayName: 'Recurring', name: 'recurring', type: 'boolean', default: true, description: 'Whether to charge on a repeating cycle. Crypto and platform currencies require this off.' },
          { displayName: 'Trial Days', name: 'trial_days', type: 'number', typeOptions: { minValue: 0, maxValue: 365 }, default: 0 },
        ],
      },

      // --- kind: pass ---
      {
        displayName: 'Pass Schedule',
        name: 'pass',
        type: 'collection',
        placeholder: 'Add Schedule Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass'] } },
        options: [
          {
            displayName: 'Cutoff Anchor',
            name: 'sales_cutoff_anchor',
            type: 'options',
            options: [
              { name: 'Before a Window Ends', value: 'before_end', description: 'Keeps selling while the window runs, so a buyer can join a session already in progress. Needs at least 5 minutes and must be under the shortest slot length.' },
              { name: 'Before a Window Starts', value: 'before_start', description: 'Nothing sells once a window is running' },
            ],
            default: 'before_start',
          },
          {
            displayName: 'Repeats',
            name: 'recurrence',
            type: 'options',
            options: [
              { name: 'Daily', value: 'daily' },
              { name: 'Monthly', value: 'monthly' },
              { name: 'Weekly', value: 'weekly' },
            ],
            default: 'weekly',
            description: 'Decides which slot fields apply: weekly uses Weekday, monthly uses Day of Month, daily uses neither',
          },
          {
            displayName: 'Schedule Mode',
            name: 'schedule_mode',
            type: 'options',
            options: [
              { name: 'Fixed', value: 'fixed', description: 'Place each window by hand' },
              { name: 'Repeating', value: 'repeating', description: 'Generate windows from the slots below' },
            ],
            default: 'repeating',
          },
          { displayName: 'Stop Generating After', name: 'recurrence_ends_at', type: 'dateTime', default: '', description: 'When window generation stops' },
          { displayName: 'Stop Selling (Minutes)', name: 'sales_cutoff_minutes', type: 'number', typeOptions: { minValue: 0 }, default: 0, description: 'Close sales this many minutes before the moment the anchor names' },
          { displayName: 'Timezone', name: 'timezone', type: 'string', default: 'UTC', description: 'IANA zone, e.g. America/New_York. Window times are local wall-clock in this zone and hold steady across daylight saving.' },
        ],
      },
      {
        displayName: 'Access Windows',
        name: 'passSlots',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Window',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass'] } },
        description: 'Sending these REPLACES the whole schedule and rebuilds unsold future windows. Windows customers already bought keep their original times.',
        options: [
          {
            name: 'slot',
            displayName: 'Window',
            values: [
              { displayName: 'Weekday', name: 'weekday', type: 'number', typeOptions: { minValue: 0, maxValue: 6 }, default: 0, description: '0-6 with 0 = Sunday. Weekly recurrence only.' },
              { displayName: 'Day of Month', name: 'day_of_month', type: 'number', typeOptions: { minValue: 1, maxValue: 31 }, default: 1, description: 'Monthly recurrence only. 29-31 skip months that lack the day.' },
              { displayName: 'Starts At', name: 'start_time', type: 'string', default: '09:00', description: 'HH:MM local wall-clock in the schedule timezone' },
              { displayName: 'Lasts (Minutes)', name: 'duration_minutes', type: 'number', typeOptions: { minValue: 5 }, default: 180, description: 'Each window carries its own length, so one plan can mix a 3-hour and a 14-hour window' },
            ],
          },
        ],
      },

      // --- kind: pass_series ---
      {
        displayName: 'Pass Window Names or IDs',
        name: 'seriesWindowIds',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        description: 'Comma-separated UUIDs of windows that ALREADY EXIST on your pass plans — a series never creates any. Use the Pass Window: List operation to find them. Needs at least two, unless a rule below supplies them.',
      },
      {
        displayName: 'Series Settings',
        name: 'passSeries',
        type: 'collection',
        placeholder: 'Add Series Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        options: [
          {
            displayName: 'Cutoff Anchor',
            name: 'sales_cutoff_anchor',
            type: 'options',
            options: [
              { name: 'Before the First Pass Opens', value: 'before_start', description: 'Nobody buys a season already underway' },
              { name: 'Before the Last Pass Ends', value: 'before_end', description: 'Keeps selling mid-season at full price for whatever is left. Nothing is prorated.' },
            ],
            default: 'before_start',
          },
          { displayName: 'Excluded Window IDs', name: 'blackout_window_ids', type: 'string', default: '', description: 'Comma-separated window UUIDs a rule matches but you want permanently excluded' },
          { displayName: 'Holders Buy First For (Hours)', name: 'presale_hours', type: 'number', typeOptions: { minValue: 1, maxValue: 8760 }, default: 48, description: 'How long the next season is held for existing holders before general sale' },
          { displayName: 'Next Series Plan ID', name: 'successor_plan_id', type: 'string', default: '', description: 'Another Pass Series on this project. When this season finishes, its holders are invited to buy that one first.' },
          { displayName: 'Prevent Overlapping Passes', name: 'prevent_overlaps', type: 'boolean', default: true, description: 'Whether to refuse a window that clashes with one already on the slate, so holders are never handed two things at the same time' },
          { displayName: 'Seat Limit', name: 'seat_cap', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'How many people may hold this series at once. Omit for unlimited.' },
          { displayName: 'Stop Selling (Minutes)', name: 'sales_cutoff_minutes', type: 'number', typeOptions: { minValue: 0 }, default: 0, description: 'Measured against the WHOLE season, not one window' },
        ],
      },
      {
        displayName: 'Automatic Inclusion Rules',
        name: 'seriesRules',
        type: 'fixedCollection',
        typeOptions: { multipleValues: true },
        placeholder: 'Add Rule',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['create', 'update'], kind: ['pass_series'] } },
        description: 'Rules keep working after the save: a matching window scheduled later is added to the slate AND granted to everyone already holding the series, at no charge. Handpicked window IDs never grow on their own.',
        options: [
          {
            name: 'rule',
            displayName: 'Rule',
            values: [
											{
												displayName: 'Number of Passes to Take',
												name: 'take',
												type: 'number',
												default: 5,
												description: 'REQUIRED when the rule type is The Next Few Passes. A count rule takes that many and then stops	—	it never tops itself back up.',
											},
											{
												displayName: 'Rule Type',
												name: 'kind',
												type: 'options',
												options: [
													{
														name: 'Every Pass Starting in a Period',
														value: 'date_range',
													},
													{
														name: 'The Next Few Passes',
														value: 'next_n',
													},
												],
												default: 'date_range',
											},
											{
												displayName: 'Source Pass Plan ID',
												name: 'source_plan_id',
												type: 'string',
												default: '',
												description: 'Must be a Time-Limited Pass plan on this project',
											},
											{
												displayName: 'Watch From',
												name: 'from_at',
												type: 'dateTime',
												default: '',
											},
											{
												displayName: 'Watch Until',
												name: 'to_at',
												type: 'dateTime',
												default: '',
											},
									],
          },
        ],
      },

      {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['plan'], operation: ['update'] } },
        options: [
          { displayName: 'Name', name: 'name', type: 'string', default: '' },
          { displayName: 'Description', name: 'description', type: 'string', default: '', typeOptions: { rows: 3 } },
          { displayName: 'Price', name: 'price', type: 'number', typeOptions: { numberPrecision: 2 }, default: 0 },
          { displayName: 'Active', name: 'active', type: 'boolean', default: true },
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
          { name: 'List', value: 'list', action: 'List subscriptions', description: 'List subscriptions filtered by status or plan' },
        ],
        default: 'cancel',
      },
      {
        displayName: 'Subscription ID',
        name: 'subscriptionId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['subscription'], operation: ['cancel', 'get'] } },
      },
      {
        displayName: 'Filters',
        name: 'subscriptionListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['subscription'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by subscription status (e.g. active, cancelled, trial)' },
          { displayName: 'Plan ID', name: 'planId', type: 'string', default: '', description: 'Filter by plan UUID' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },
      {
        displayName: 'Cancel at Period End',
        name: 'atPeriodEnd',
        type: 'boolean',
        default: true,
        displayOptions: { show: { resource: ['subscription'], operation: ['cancel'] } },
        description: 'Whether to let the subscription run until its current period ends. Off = cancel immediately.',
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
          { name: 'Get', value: 'get', action: 'Get a member', description: 'Fetch a member by UUID' },
          { name: 'Kick', value: 'kick', action: 'Kick a member', description: 'Remove a member without a permanent ban' },
          { name: 'List', value: 'list', action: 'List members', description: 'List members of a project' },
          { name: 'Unban', value: 'unban', action: 'Unban a member', description: 'Lift a previous ban' },
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
        displayOptions: { show: { resource: ['member'], operation: ['ban', 'unban', 'kick', 'get'] } },
      },
      {
        displayName: 'Filters',
        name: 'memberListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['member'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by member status (e.g. active, banned, kicked)' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },
      {
        displayName: 'Reason',
        name: 'reason',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['member'], operation: ['ban', 'kick'] } },
        description: 'Optional moderator note recorded with the action',
      },

      // === SUPPORT CONVERSATION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['supportConversation'] } },
        options: [
          { name: 'Assign', value: 'assign', action: 'Assign a support conversation', description: 'Hand the conversation to a team member, or clear the assignment' },
          { name: 'Get', value: 'get', action: 'Get a support conversation', description: 'Fetch one conversation by UUID' },
          { name: 'List', value: 'list', action: 'List support conversations', description: 'List conversations, newest activity first' },
          { name: 'List Messages', value: 'listMessages', action: 'List support messages', description: 'Fetch the messages in a conversation, oldest first' },
          { name: 'Reply', value: 'reply', action: 'Reply to a support conversation', description: 'Send a reply the member receives on Telegram' },
          { name: 'Resolve', value: 'resolve', action: 'Resolve a support conversation', description: 'Clear the conversation from the open queue' },
        ],
        default: 'list',
      },
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['get', 'listMessages', 'reply', 'resolve', 'assign'] } },
      },
      {
        displayName: 'Reply',
        name: 'replyBody',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Reaches the member verbatim on Telegram, attributed to you rather than the bot. Max 4000 characters.',
      },
      {
        displayName: 'Quote Message ID',
        name: 'replyToMessageId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Optional UUID of a message in this same conversation to quote above the reply. Must belong to this conversation.',
      },
      {
        displayName: 'Internal Note',
        name: 'replyInternal',
        type: 'boolean',
        default: false,
        displayOptions: { show: { resource: ['supportConversation'], operation: ['reply'] } },
        description: 'Whether to record a private note for your team instead of replying to the member',
      },
      {
        displayName: 'Assignee',
        name: 'assignedToUserId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['supportConversation'], operation: ['assign'] } },
        description: 'Team-member user UUID. Leave empty to clear an existing assignment.',
      },
      {
        displayName: 'Filters',
        name: 'supportConversationListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['supportConversation'], operation: ['list', 'listMessages'] } },
        options: [
          { displayName: 'Assigned To', name: 'assignedTo', type: 'string', default: '', description: 'Only conversations assigned to this team-member UUID' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Project ID', name: 'projectId', type: 'string', default: '', description: 'Narrow to a single project' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Status', name: 'status', type: 'options', default: 'open', options: [
            { name: 'Open', value: 'open' },
            { name: 'Pending', value: 'pending' },
            { name: 'Resolved', value: 'resolved' },
            { name: 'Snoozed', value: 'snoozed' },
          ], description: 'Filter by conversation status' },
        ],
      },

      // === SUBSCRIBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['subscriber'] } },
        options: [
          { name: 'Find by Telegram ID', value: 'findByTelegramId', action: 'Find a subscriber by telegram id', description: 'Return the subscriber whose Telegram user ID matches' },
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
          { name: 'List', value: 'list', action: 'List access codes', description: 'List all access codes under a plan' },
          { name: 'Delete', value: 'delete', action: 'Delete an access code', description: 'Revoke a single access code' },
          { name: 'Preview', value: 'preview', action: 'Preview access code generation', description: 'Dry-run generation to preview the codes that would be issued' },
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
        displayName: 'Access Code ID',
        name: 'accessCodeId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['accessCode'], operation: ['delete'] } },
        description: 'UUID of the access code to revoke',
      },
      {
        displayName: 'Quantity',
        name: 'quantity',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 1000 },
        default: 10,
        required: true,
        displayOptions: { show: { resource: ['accessCode'], operation: ['bulkGenerate', 'preview'] } },
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
      {
        displayName: 'Filters',
        name: 'accessCodeListFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['accessCode'], operation: ['list'] } },
        options: [
          { displayName: 'Status', name: 'status', type: 'string', default: '', description: 'Filter by access code status (e.g. active, redeemed, expired)' },
          { displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, description: 'Whether to return all results or only up to a given limit' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
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
          { name: 'Delete', value: 'delete', action: 'Delete a resource', description: 'Permanently delete a resource' },
          { name: 'Get', value: 'get', action: 'Get a resource', description: 'Fetch a resource by UUID' },
          { name: 'List', value: 'list', action: 'List resources', description: 'List all resources attached to a project' },
          { name: 'Unlink', value: 'unlink', action: 'Unlink a resource', description: 'Detach a resource from delivery without deleting it' },
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
        displayName: 'Resource ID',
        name: 'resourceId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['resource'], operation: ['get', 'unlink', 'delete'] } },
        description: 'UUID of the resource',
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

      // === PAYMENT METHOD ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['paymentMethod'] } },
        options: [
          { name: 'List', value: 'list', action: 'List payment methods', description: 'List all payment methods for a project' },
          { name: 'Get', value: 'get', action: 'Get a payment method', description: 'Fetch a payment method by UUID' },
        ],
        default: 'list',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['paymentMethod'] } },
      },
      {
        displayName: 'Method ID',
        name: 'methodId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['paymentMethod'], operation: ['get'] } },
        description: 'UUID of the payment method',
      },

      // === WEBHOOK ENDPOINT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['webhookEndpoint'] } },
        options: [
          { name: 'Create', value: 'create', action: 'Create a webhook endpoint', description: 'Register a new webhook endpoint' },
          { name: 'Delete', value: 'delete', action: 'Delete a webhook endpoint', description: 'Remove a webhook endpoint' },
          { name: 'List', value: 'list', action: 'List webhook endpoints', description: 'List all webhook endpoints for the current team' },
          { name: 'Rotate Secret', value: 'rotateSecret', action: 'Rotate the signing secret', description: 'Rotate the HMAC signing secret for a webhook endpoint' },
          { name: 'Test', value: 'test', action: 'Send a test delivery', description: 'Trigger a test delivery from Subscriby to the endpoint' },
        ],
        default: 'list',
      },
      {
        displayName: 'Endpoint ID',
        name: 'endpointId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['delete', 'rotateSecret', 'test'] } },
        description: 'UUID of the webhook endpoint',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'Human-readable label for the endpoint',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'HTTPS URL that will receive event deliveries',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        description: 'Comma-separated list of event types to subscribe to (e.g. subscription.created,payment.succeeded)',
      },
      {
        displayName: 'Additional Fields',
        name: 'webhookEndpointFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: { show: { resource: ['webhookEndpoint'], operation: ['create'] } },
        options: [
          { displayName: 'Project ID', name: 'project_id', type: 'string', default: '', description: 'Restrict deliveries to a single project' },
          { displayName: 'Allowed IPs', name: 'allowed_ips', type: 'string', default: '', description: 'Comma-separated list of IP addresses permitted to receive deliveries' },
          { displayName: 'Is Active', name: 'is_active', type: 'boolean', default: true },
        ],
      },

      // === WEBHOOK DELIVERY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['webhookDelivery'] } },
        options: [
          { name: 'List', value: 'list', action: 'List webhook deliveries', description: 'List recent webhook event deliveries by event type' },
        ],
        default: 'list',
      },
      {
        displayName: 'Event Type',
        name: 'type',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['webhookDelivery'], operation: ['list'] } },
        description: 'Event type to filter by (e.g. subscription.created)',
      },
      {
        displayName: 'Additional Fields',
        name: 'webhookDeliveryFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: { show: { resource: ['webhookDelivery'], operation: ['list'] } },
        options: [
          { displayName: 'Project ID', name: 'project_id', type: 'string', default: '' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
        ],
      },

      // === TOKEN ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['token'] } },
        options: [
          { name: 'List', value: 'list', action: 'List API tokens', description: 'List all API tokens for the current team' },
          { name: 'Get', value: 'get', action: 'Get an API token', description: 'Fetch an API token by UUID' },
          { name: 'Revoke', value: 'revoke', action: 'Revoke an API token', description: 'Revoke an API token immediately' },
        ],
        default: 'list',
      },
      {
        displayName: 'Token ID',
        name: 'tokenId',
        type: 'string',
								typeOptions: { password: true },
        default: '',
        required: true,
        displayOptions: { show: { resource: ['token'], operation: ['get', 'revoke'] } },
        description: 'UUID of the API token',
      },

      // === TEAM ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['team'] } },
        options: [
          { name: 'List', value: 'list', action: 'List teams', description: 'List all teams the caller belongs to' },
          { name: 'Get', value: 'get', action: 'Get a team', description: 'Fetch a team by UUID' },
          { name: 'Get Current', value: 'getCurrent', action: 'Get the current team', description: 'Fetch the team that owns the API token' },
        ],
        default: 'list',
      },
      {
        displayName: 'Team ID',
        name: 'teamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['team'], operation: ['get'] } },
        description: 'UUID of the team',
      },

      // === TEAM MEMBER ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['teamMember'] } },
        options: [
          { name: 'List', value: 'list', action: 'List team members', description: 'List all members of a team' },
          { name: 'Get', value: 'get', action: 'Get a team member', description: 'Fetch a single team member' },
        ],
        default: 'list',
      },
      {
        displayName: 'Team ID',
        name: 'teamId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'] } },
      },
      {
        displayName: 'User ID',
        name: 'userId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['teamMember'], operation: ['get'] } },
        description: 'UUID of the team member (user)',
      },

      // === ROLE ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['role'] } },
        options: [
          { name: 'List', value: 'list', action: 'List roles', description: 'List all roles defined for the current team' },
          { name: 'Get', value: 'get', action: 'Get a role', description: 'Fetch a role by UUID' },
        ],
        default: 'list',
      },
      {
        displayName: 'Role ID',
        name: 'roleId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['role'], operation: ['get'] } },
        description: 'UUID of the role',
      },

      // === GROUP ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['group'] } },
        options: [
          { name: 'List', value: 'list', action: 'List groups', description: 'List all groups for the current team' },
          { name: 'Get', value: 'get', action: 'Get a group', description: 'Fetch a group by UUID' },
        ],
        default: 'list',
      },
      {
        displayName: 'Group ID',
        name: 'groupId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['group'], operation: ['get'] } },
        description: 'UUID of the group',
      },

      // === ACTIVITY ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['activity'] } },
        options: [
          { name: 'List', value: 'list', action: 'List activity log entries', description: 'List activity log entries for a subject' },
        ],
        default: 'list',
      },
      {
        displayName: 'Subject Type',
        name: 'subjectType',
        type: 'options',
        options: [
          { name: 'Access Code', value: 'access-code' },
          { name: 'Member', value: 'member' },
          { name: 'Plan', value: 'plan' },
          { name: 'Project', value: 'project' },
          { name: 'Subscription', value: 'subscription' },
        ],
        default: 'project',
        required: true,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
      },
      {
        displayName: 'Subject ID',
        name: 'subjectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
        description: 'UUID of the subject to query activity for',
      },
      {
        displayName: 'Limit',
        name: 'activityLimit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 200 },
        default: 50,
        displayOptions: { show: { resource: ['activity'], operation: ['list'] } },
      },

      // === BOT ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['bot'] } },
        options: [
          { name: 'Get Status', value: 'getStatus', action: 'Get bot status', description: 'Fetch the current bot connection status for a project' },
        ],
        default: 'getStatus',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['bot'] } },
      },

      // === DISTRIBUTION ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['distribution'] } },
        options: [
          { name: 'Get Bot Link', value: 'getBotLink', action: 'Get bot link', description: 'Fetch the Telegram bot link for a project' },
          { name: 'Get Portal URL', value: 'getPortalUrl', action: 'Get portal URL', description: 'Fetch the public portal URL for a project' },
          { name: 'Get Deep Link', value: 'getDeepLink', action: 'Get a deep link', description: 'Generate a Telegram deep link targeting an access code, plan, or custom payload' },
        ],
        default: 'getBotLink',
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['distribution'] } },
      },
      {
        displayName: 'Deep Link Target',
        name: 'deepLinkTarget',
        type: 'collection',
        placeholder: 'Add Target',
        default: {},
        displayOptions: { show: { resource: ['distribution'], operation: ['getDeepLink'] } },
        description: 'Provide exactly one of access_code, plan_id, or custom',
        options: [
          { displayName: 'Access Code', name: 'access_code', type: 'string', default: '' },
          { displayName: 'Plan ID', name: 'plan_id', type: 'string', default: '' },
          { displayName: 'Custom', name: 'custom', type: 'string', default: '' },
        ],
      },

      // === ANALYTICS ===
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: { show: { resource: ['analytics'] } },
        options: [
          { name: 'Get Dashboard', value: 'getDashboard', action: 'Get dashboard analytics', description: 'Fetch aggregated dashboard metrics' },
          { name: 'Get Earnings', value: 'getEarnings', action: 'Get earnings analytics', description: 'Fetch earnings time-series data' },
          { name: 'Get Plan Performance', value: 'getPlanPerformance', action: 'Get plan performance', description: 'Fetch per-plan performance analytics for a project' },
          { name: 'Get Subscribers', value: 'getSubscribers', action: 'Get subscriber analytics', description: 'Fetch subscriber growth analytics' },
          { name: 'Get Transaction Breakdown', value: 'getTransactionBreakdown', action: 'Get transaction breakdown', description: 'Fetch a transaction breakdown by dimension' },
          { name: 'List Transactions', value: 'listTransactions', action: 'List transactions', description: 'List raw transactions for a project' },
        ],
        default: 'getDashboard',
      },
      {
        displayName: 'Project ID',
        name: 'analyticsProjectId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['analytics'], operation: ['getPlanPerformance', 'listTransactions'] } },
      },
      {
        displayName: 'Dimension',
        name: 'dimension',
        type: 'options',
        options: [
          { name: 'Plan', value: 'plan' },
          { name: 'Payment Provider', value: 'payment_provider' },
          { name: 'Currency', value: 'currency' },
          { name: 'Project', value: 'project' },
        ],
        default: 'plan',
        required: true,
        displayOptions: { show: { resource: ['analytics'], operation: ['getTransactionBreakdown'] } },
      },
      {
        displayName: 'Granularity',
        name: 'granularity',
        type: 'options',
        options: [
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
        ],
        default: 'day',
        displayOptions: { show: { resource: ['analytics'], operation: ['getEarnings'] } },
      },
      {
        displayName: 'Additional Fields',
        name: 'analyticsFilters',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: {
            resource: ['analytics'],
            operation: [
              'getDashboard',
              'getEarnings',
              'getSubscribers',
              'getTransactionBreakdown',
              'getPlanPerformance',
              'listTransactions',
            ],
          },
        },
        options: [
          { displayName: 'Compare Period', name: 'compare_period', type: 'string', default: '', description: 'Comparison window (e.g. prev_period)' },
          { displayName: 'Cursor', name: 'cursor', type: 'string', default: '', description: 'Opaque pagination cursor' },
          { displayName: 'From', name: 'from', type: 'string', default: '', description: 'ISO 8601 start date' },
          { displayName: 'Limit', name: 'limit', type: 'number', typeOptions: { minValue: 1 }, default: 50, description: 'Max number of results to return' },
          { displayName: 'Period', name: 'period', type: 'string', default: '', description: 'Pre-set period like 7d, 30d, mtd, ytd' },
          { displayName: 'Project ID', name: 'project_id', type: 'string', default: '', description: 'Scope to a single project (where optional)' },
          { displayName: 'To', name: 'to', type: 'string', default: '', description: 'ISO 8601 end date' },
        ],
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
        throw toNodeError(this.getNode(), error);
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
    case 'passWindow':
      return dispatchPassWindow.call(this, operation, i);
    case 'plan':
      return dispatchPlan.call(this, operation, i);
    case 'subscription':
      return dispatchSubscription.call(this, operation, i);
    case 'member':
      return dispatchMember.call(this, operation, i);
    case 'supportConversation':
      return dispatchSupportConversation.call(this, operation, i);
    case 'subscriber':
      return dispatchSubscriber.call(this, operation, i);
    case 'accessCode':
      return dispatchAccessCode.call(this, operation, i);
    case 'resource':
      return dispatchResource.call(this, operation, i);
    case 'paymentMethod':
      return dispatchPaymentMethod.call(this, operation, i);
    case 'webhookEndpoint':
      return dispatchWebhookEndpoint.call(this, operation, i);
    case 'webhookDelivery':
      return dispatchWebhookDelivery.call(this, operation, i);
    case 'token':
      return dispatchToken.call(this, operation, i);
    case 'team':
      return dispatchTeam.call(this, operation, i);
    case 'teamMember':
      return dispatchTeamMember.call(this, operation, i);
    case 'role':
      return dispatchRole.call(this, operation, i);
    case 'group':
      return dispatchGroup.call(this, operation, i);
    case 'activity':
      return dispatchActivity.call(this, operation, i);
    case 'bot':
      return dispatchBot.call(this, operation, i);
    case 'distribution':
      return dispatchDistribution.call(this, operation, i);
    case 'analytics':
      return dispatchAnalytics.call(this, operation, i);
    default:
      throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
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
    return subscribyApiRequest.call(this, 'POST', '/projects', body);
  }

  if (operation === 'update') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
    return subscribyApiRequest.call(this, 'PATCH', `/projects/${projectId}`, compactBody(updateFields));
  }

  if (operation === 'archive') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/archive`);
  }

  if (operation === 'restore') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/restore`);
  }

  if (operation === 'delete') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}`);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/projects');
    return { data: rows };
  }

  if (operation === 'get') {
    const projectId = this.getNodeParameter('projectId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}`);
  }

  if (operation === 'findByHandle') {
    const handle = this.getNodeParameter('handle', i) as string;
    return subscribyApiRequest.call(this, 'GET', '/projects', undefined, { handle });
  }

  throw new NodeOperationError(this.getNode(), `Unknown project operation: ${operation}`);
}

/**
 * The dated access windows a project's pass plans generate.
 *
 * Read-only. A Pass Series points at windows that already exist rather than
 * creating any, so this is where its window IDs come from — without it a series
 * cannot be authored from n8n at all.
 */
async function dispatchPassWindow(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = compactBody(this.getNodeParameter('filters', i, {}) as IDataObject);

    const rows = await subscribyApiRequestAllItems.call(
      this,
      'GET',
      `/projects/${projectId}/pass-windows`,
      filters,
    );

    return { data: rows };
  }

  throw new NodeOperationError(this.getNode(), `Unknown pass window operation: ${operation}`);
}

/**
 * Split a comma-separated list of ids into an array, dropping blanks.
 *
 * n8n has no plain string-list input, so multi-id fields are typed by hand.
 */
function idList(raw: string): string[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Assemble the kind-discriminated body a plan write expects.
 *
 * The Subscriby API takes `kind` plus exactly ONE nested object named after it,
 * and refuses a block belonging to another kind rather than ignoring it. n8n
 * properties are flat and gated by `displayOptions`, so only the chosen kind's
 * fields are ever on screen — this turns them into the nested shape.
 *
 * The previous version of this function sent `currency` instead of
 * `currency_id`, a `billing_cycle` enum the API does not accept, and never sent
 * the required `resources`, so every plan:create call 422'd.
 */
function buildPlanBody(this: IExecuteFunctions, i: number, isCreate: boolean): IDataObject {
  const kind = this.getNodeParameter('kind', i, 'subscription') as string;
  const body: IDataObject = { kind };

  if (isCreate) {
    body.name = this.getNodeParameter('name', i) as string;
    body.currency_id = this.getNodeParameter('currencyId', i) as string;
    body.price = this.getNodeParameter('price', i) as number;

    const resources = idList(this.getNodeParameter('resources', i, '') as string);

    if (resources.length > 0) {
      body.resources = resources;
    }
  } else {
    Object.assign(body, compactBody(this.getNodeParameter('updateFields', i, {}) as IDataObject));
  }

  if (kind === 'subscription') {
    const billing = compactBody(this.getNodeParameter('billing', i, {}) as IDataObject);

    if (Object.keys(billing).length > 0) {
      body.billing = billing;
    }

    return body;
  }

  if (kind === 'pass') {
    const pass = compactBody(this.getNodeParameter('pass', i, {}) as IDataObject);

    const slots = (this.getNodeParameter('passSlots.slot', i, []) as IDataObject[])
      .map((slot) => compactBody(slot));

    if (slots.length > 0) {
      pass.slots = slots;
    }

    if (Object.keys(pass).length > 0) {
      body.pass = pass;
    }

    return body;
  }

  const series = compactBody(this.getNodeParameter('passSeries', i, {}) as IDataObject);

  /*
   * Typed as a comma-separated string in the collection above, so it arrives
   * here as one value rather than the array the API wants.
   */
  if (typeof series.blackout_window_ids === 'string') {
    const excluded = idList(series.blackout_window_ids);

    if (excluded.length > 0) {
      series.blackout_window_ids = excluded;
    } else {
      delete series.blackout_window_ids;
    }
  }

  const windowIds = idList(this.getNodeParameter('seriesWindowIds', i, '') as string);

  if (windowIds.length > 0) {
    series.window_ids = windowIds;
  }

  const rules = (this.getNodeParameter('seriesRules.rule', i, []) as IDataObject[])
    .map((rule) => compactBody(rule));

  if (rules.length > 0) {
    series.rules = rules;
  }

  if (Object.keys(series).length > 0) {
    body.pass_series = series;
  }

  return body;
}

async function dispatchPlan(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'create') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans`,
      buildPlanBody.call(this, i, true),
    );
  }

  if (operation === 'update') {
    const planId = this.getNodeParameter('planId', i) as string;

    return subscribyApiRequest.call(
      this,
      'PATCH',
      `/projects/${projectId}/plans/${planId}`,
      buildPlanBody.call(this, i, false),
    );
  }

  if (operation === 'publish' || operation === 'unpublish') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/${operation}`,
    );
  }

  if (operation === 'get') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/plans/${planId}`);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/plans`);
    return { data: rows };
  }

  if (operation === 'delete') {
    const planId = this.getNodeParameter('planId', i) as string;
    return subscribyApiRequest.call(this, 'DELETE', `/projects/${projectId}/plans/${planId}`);
  }

  if (operation === 'findByName') {
    const planName = this.getNodeParameter('planName', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans`,
      undefined,
      { name: planName },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown plan operation: ${operation}`);
}

async function dispatchSubscription(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('subscriptionListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.planId) {
      qs.plan_id = filters.planId;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/subscriptions', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/subscriptions', undefined, qs);
  }

  const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;

  if (operation === 'cancel') {
    const atPeriodEnd = this.getNodeParameter('atPeriodEnd', i) as boolean;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/subscriptions/${subscriptionId}/cancel`,
      { at_period_end: atPeriodEnd },
    );
  }

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/subscriptions/${subscriptionId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown subscription operation: ${operation}`);
}

async function dispatchSupportConversation(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('supportConversationListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.projectId) {
      qs.project_id = filters.projectId;
    }
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.assignedTo) {
      qs.assigned_to = filters.assignedTo;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/support/conversations', qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', '/support/conversations', undefined, qs);
  }

  const conversationId = this.getNodeParameter('conversationId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/support/conversations/${conversationId}`);
  }

  if (operation === 'listMessages') {
    const filters = this.getNodeParameter('supportConversationListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(
        this,
        'GET',
        `/support/conversations/${conversationId}/messages`,
        qs,
      );
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(
      this,
      'GET',
      `/support/conversations/${conversationId}/messages`,
      undefined,
      qs,
    );
  }

  if (operation === 'reply') {
    const payload: IDataObject = {
      body: this.getNodeParameter('replyBody', i) as string,
      internal: this.getNodeParameter('replyInternal', i, false) as boolean,
    };

    const quoted = this.getNodeParameter('replyToMessageId', i, '') as string;

    if (quoted) {
      payload.reply_to_message_id = quoted;
    }

    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/messages`, payload);
  }

  if (operation === 'resolve') {
    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/resolve`);
  }

  if (operation === 'assign') {
    const assignee = this.getNodeParameter('assignedToUserId', i, '') as string;

    // Sent explicitly rather than compacted away: the API requires the key to be
    // present, so clearing an assignment is a deliberate null.
    return subscribyApiRequest.call(this, 'POST', `/support/conversations/${conversationId}/assign`, {
      assigned_to_user_id: assignee === '' ? null : assignee,
    });
  }

  throw new NodeOperationError(this.getNode(), `Unknown support conversation operation: ${operation}`);
}

async function dispatchMember(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const filters = this.getNodeParameter('memberListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/members`, qs);
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/members`, undefined, qs);
  }

  const memberId = this.getNodeParameter('memberId', i) as string;

  if (operation === 'ban' || operation === 'kick') {
    const reason = this.getNodeParameter('reason', i, '') as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/${operation}`,
      compactBody({ reason }),
    );
  }

  if (operation === 'unban') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/members/${memberId}/unban`,
    );
  }

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/members/${memberId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown member operation: ${operation}`);
}

async function dispatchSubscriber(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'findByTelegramId') {
    const telegramId = this.getNodeParameter('telegramId', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/members`,
      undefined,
      { telegram_id: telegramId },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown subscriber operation: ${operation}`);
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

    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/plans/${planId}/access-codes/bulk-generate`,
      body,
    );
  }

  if (operation === 'list') {
    const filters = this.getNodeParameter('accessCodeListFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.status) {
      qs.status = filters.status;
    }
    if (filters.returnAll === true) {
      const rows = await subscribyApiRequestAllItems.call(
        this,
        'GET',
        `/projects/${projectId}/plans/${planId}/access-codes`,
        qs,
      );
      return { data: rows };
    }
    qs.per_page = Math.min(Number(filters.limit ?? 50), 100);
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans/${planId}/access-codes`,
      undefined,
      qs,
    );
  }

  if (operation === 'delete') {
    const accessCodeId = this.getNodeParameter('accessCodeId', i) as string;
    return subscribyApiRequest.call(
      this,
      'DELETE',
      `/projects/${projectId}/plans/${planId}/access-codes/${accessCodeId}`,
    );
  }

  if (operation === 'preview') {
    const quantity = this.getNodeParameter('quantity', i) as number;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/plans/${planId}/access-codes/preview`,
      undefined,
      { quantity },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown access code operation: ${operation}`);
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
    return subscribyApiRequest.call(this, 'POST', `/projects/${projectId}/resources`, body);
  }

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/resources`);
    return { data: rows };
  }

  if (operation === 'get') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/resources/${resourceId}`);
  }

  if (operation === 'unlink') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(
      this,
      'POST',
      `/projects/${projectId}/resources/${resourceId}/unlink`,
    );
  }

  if (operation === 'delete') {
    const resourceId = this.getNodeParameter('resourceId', i) as string;
    return subscribyApiRequest.call(
      this,
      'DELETE',
      `/projects/${projectId}/resources/${resourceId}`,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown resource operation: ${operation}`);
}

async function dispatchPaymentMethod(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', `/projects/${projectId}/payment-methods`);
    return { data: rows };
  }

  if (operation === 'get') {
    const methodId = this.getNodeParameter('methodId', i) as string;
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/payment-methods/${methodId}`,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown payment method operation: ${operation}`);
}

async function dispatchWebhookEndpoint(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/webhook-endpoints');
    return { data: rows };
  }

  if (operation === 'create') {
    const name = this.getNodeParameter('name', i) as string;
    const url = this.getNodeParameter('url', i) as string;
    const eventsInput = this.getNodeParameter('events', i) as string;
    const extras = this.getNodeParameter('webhookEndpointFields', i, {}) as IDataObject;

    const events = eventsInput
      .split(',')
      .map((event) => event.trim())
      .filter((event) => event.length > 0);

    const body: IDataObject = compactBody({
      name,
      url,
      events,
      project_id: extras.project_id,
    });

    if (extras.allowed_ips) {
      body.allowed_ips = String(extras.allowed_ips)
        .split(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0);
    }

    if (extras.is_active !== undefined) {
      body.is_active = extras.is_active;
    }

    return subscribyApiRequest.call(this, 'POST', '/webhook-endpoints', body);
  }

  const endpointId = this.getNodeParameter('endpointId', i) as string;

  if (operation === 'delete') {
    return subscribyApiRequest.call(this, 'DELETE', `/webhook-endpoints/${endpointId}`);
  }

  if (operation === 'rotateSecret') {
    return subscribyApiRequest.call(
      this,
      'POST',
      `/webhook-endpoints/${endpointId}/rotate-secret`,
    );
  }

  if (operation === 'test') {
    return subscribyApiRequest.call(this, 'POST', `/webhook-endpoints/${endpointId}/test`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown webhook endpoint operation: ${operation}`);
}

async function dispatchWebhookDelivery(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const type = this.getNodeParameter('type', i) as string;
    const filters = this.getNodeParameter('webhookDeliveryFilters', i, {}) as IDataObject;

    const qs: IDataObject = { type };
    if (filters.project_id) {
      qs.project_id = filters.project_id;
    }
    if (filters.limit !== undefined && filters.limit !== '') {
      qs.limit = filters.limit;
    }

    return subscribyApiRequest.call(this, 'GET', '/webhook-events', undefined, qs);
  }

  throw new NodeOperationError(this.getNode(), `Unknown webhook delivery operation: ${operation}`);
}

async function dispatchToken(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/tokens');
    return { data: rows };
  }

  const tokenId = this.getNodeParameter('tokenId', i) as string;

  if (operation === 'get') {
    return subscribyApiRequest.call(this, 'GET', `/tokens/${tokenId}`);
  }

  if (operation === 'revoke') {
    return subscribyApiRequest.call(this, 'DELETE', `/tokens/${tokenId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown token operation: ${operation}`);
}

async function dispatchTeam(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    return subscribyApiRequest.call(this, 'GET', '/teams');
  }

  if (operation === 'getCurrent') {
    return subscribyApiRequest.call(this, 'GET', '/teams/current');
  }

  if (operation === 'get') {
    const teamId = this.getNodeParameter('teamId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown team operation: ${operation}`);
}

async function dispatchTeamMember(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const teamId = this.getNodeParameter('teamId', i) as string;

  if (operation === 'list') {
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}/members`);
  }

  if (operation === 'get') {
    const userId = this.getNodeParameter('userId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/teams/${teamId}/members/${userId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown team member operation: ${operation}`);
}

async function dispatchRole(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/roles');
    return { data: rows };
  }

  if (operation === 'get') {
    const roleId = this.getNodeParameter('roleId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/roles/${roleId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown role operation: ${operation}`);
}

async function dispatchGroup(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const rows = await subscribyApiRequestAllItems.call(this, 'GET', '/groups');
    return { data: rows };
  }

  if (operation === 'get') {
    const groupId = this.getNodeParameter('groupId', i) as string;
    return subscribyApiRequest.call(this, 'GET', `/groups/${groupId}`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown group operation: ${operation}`);
}

async function dispatchActivity(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  if (operation === 'list') {
    const subjectType = this.getNodeParameter('subjectType', i) as string;
    const subjectId = this.getNodeParameter('subjectId', i) as string;
    const limit = this.getNodeParameter('activityLimit', i, 50) as number;

    const qs: IDataObject = {
      subject_type: subjectType,
      subject_id: subjectId,
    };
    if (limit) {
      qs.limit = limit;
    }

    return subscribyApiRequest.call(this, 'GET', '/activity', undefined, qs);
  }

  throw new NodeOperationError(this.getNode(), `Unknown activity operation: ${operation}`);
}

async function dispatchBot(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'getStatus') {
    return subscribyApiRequest.call(this, 'GET', `/projects/${projectId}/bot`);
  }

  throw new NodeOperationError(this.getNode(), `Unknown bot operation: ${operation}`);
}

async function dispatchDistribution(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const projectId = this.getNodeParameter('projectId', i) as string;

  if (operation === 'getBotLink') {
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/bot-link`,
    );
  }

  if (operation === 'getPortalUrl') {
    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/portal-url`,
    );
  }

  if (operation === 'getDeepLink') {
    const target = this.getNodeParameter('deepLinkTarget', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (target.access_code) {
      qs.access_code = target.access_code;
    }
    if (target.plan_id) {
      qs.plan_id = target.plan_id;
    }
    if (target.custom) {
      qs.custom = target.custom;
    }

    return subscribyApiRequest.call(
      this,
      'GET',
      `/projects/${projectId}/distribution/deep-link`,
      undefined,
      qs,
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown distribution operation: ${operation}`);
}

async function dispatchAnalytics(
  this: IExecuteFunctions,
  operation: string,
  i: number,
): Promise<IDataObject> {
  const filters = this.getNodeParameter('analyticsFilters', i, {}) as IDataObject;
  const qs: IDataObject = {};
  const passthrough: Array<keyof IDataObject> = [
    'project_id',
    'period',
    'from',
    'to',
    'compare_period',
    'cursor',
    'limit',
  ];
  for (const key of passthrough) {
    const value = filters[key];
    if (value !== undefined && value !== '') {
      qs[key as string] = value;
    }
  }

  if (operation === 'getDashboard') {
    return subscribyApiRequest.call(this, 'GET', '/analytics/dashboard', undefined, qs);
  }

  if (operation === 'getEarnings') {
    const granularity = this.getNodeParameter('granularity', i, '') as string;
    if (granularity) {
      qs.granularity = granularity;
    }
    return subscribyApiRequest.call(this, 'GET', '/analytics/earnings', undefined, qs);
  }

  if (operation === 'getSubscribers') {
    return subscribyApiRequest.call(this, 'GET', '/analytics/subscribers', undefined, qs);
  }

  if (operation === 'getTransactionBreakdown') {
    const dimension = this.getNodeParameter('dimension', i) as string;
    qs.dimension = dimension;
    return subscribyApiRequest.call(
      this,
      'GET',
      '/analytics/transactions/breakdown',
      undefined,
      qs,
    );
  }

  if (operation === 'getPlanPerformance') {
    const projectId = this.getNodeParameter('analyticsProjectId', i) as string;
    qs.project_id = projectId;
    return subscribyApiRequest.call(this, 'GET', '/analytics/plan-performance', undefined, qs);
  }

  if (operation === 'listTransactions') {
    const projectId = this.getNodeParameter('analyticsProjectId', i) as string;
    qs.project_id = projectId;
    return subscribyApiRequest.call(this, 'GET', '/analytics/transactions', undefined, qs);
  }

  throw new NodeOperationError(this.getNode(), `Unknown analytics operation: ${operation}`);
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
