import type {
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
  IDataObject,
} from 'n8n-workflow';
import { createHmac, timingSafeEqual } from 'crypto';

import { memberPassApiRequest } from '../MemberPass/GenericFunctions';

/**
 * Webhook trigger that subscribes to one or more MemberPass event types.
 *
 * Lifecycle:
 *  - create():  POST /webhook-subscriptions → receives {id, secret}
 *  - delete():  DELETE /webhook-subscriptions/{id}
 *  - webhook(): validates MP-Signature, returns event envelope to the workflow
 *
 * Subscribed event names match the catalog at
 * https://docs.memberpass.net/webhooks/event-reference (19 events covering
 * subscriptions, payments, members, access codes, plans, projects).
 */
export class MemberPassTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MemberPass Trigger',
    name: 'memberPassTrigger',
    icon: 'file:memberpass.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts a workflow when a MemberPass event fires (subscription, payment, member, access code, plan, project).',
    defaults: {
      name: 'MemberPass Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'memberPassApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'memberpass',
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: [],
        description: 'Event types that will start this workflow',
        options: [
          { name: 'Access Code — Expired', value: 'access_code.expired' },
          { name: 'Access Code — Generated', value: 'access_code.generated' },
          { name: 'Access Code — Redeemed', value: 'access_code.redeemed' },
          { name: 'Member — Banned', value: 'member.banned' },
          { name: 'Member — Joined', value: 'member.joined' },
          { name: 'Member — Kicked', value: 'member.kicked' },
          { name: 'Member — Trial Joined', value: 'member.trial_joined' },
          { name: 'Member — Unbanned', value: 'member.unbanned' },
          { name: 'Payment — Failed', value: 'payment.failed' },
          { name: 'Payment — Succeeded', value: 'payment.succeeded' },
          { name: 'Plan — Created', value: 'plan.created' },
          { name: 'Plan — Deactivated', value: 'plan.deactivated' },
          { name: 'Plan — Updated', value: 'plan.updated' },
          { name: 'Project — Created', value: 'project.created' },
          { name: 'Subscription — Activated', value: 'subscription.activated' },
          { name: 'Subscription — Cancelled', value: 'subscription.cancelled' },
          { name: 'Subscription — Created', value: 'subscription.created' },
          { name: 'Subscription — Expired', value: 'subscription.expired' },
          { name: 'Subscription — Renewed', value: 'subscription.renewed' },
        ],
      },
      {
        displayName: 'Project ID',
        name: 'projectId',
        type: 'string',
        default: '',
        description: 'Optional — restrict deliveries to a single project. Leave blank to receive team-wide events.',
      },
      {
        displayName: 'Verify Signature',
        name: 'verifySignature',
        type: 'boolean',
        default: true,
        description: 'Whether to validate the MP-Signature HMAC on every incoming request. Disable only for local debugging.',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        return Boolean(webhookData.webhookId);
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = this.getNodeParameter('events') as string[];
        const projectId = this.getNodeParameter('projectId', '') as string;
        const workflowId = this.getWorkflow().id ?? 'workflow';

        if (!events || events.length === 0) {
          throw new Error('Select at least one event to subscribe to.');
        }

        const body: IDataObject = {
          name: `n8n — ${this.getNode().name}`,
          url: webhookUrl,
          events,
        };

        if (projectId) {
          body.project_id = projectId;
        }

        const response = await memberPassApiRequest.call(
          this,
          'POST',
          '/webhook-subscriptions',
          body,
          undefined,
          {
            headers: {
              'Idempotency-Key': `n8n-${workflowId}-${this.getNode().name}-create`,
            },
          },
        );

        const envelope = (response.data as IDataObject | undefined) ?? response;
        const endpointId = (envelope as IDataObject).id as string | undefined;
        const secret = response.secret as string | undefined;

        if (!endpointId) {
          throw new Error('MemberPass did not return a webhook endpoint id.');
        }

        const webhookData = this.getWorkflowStaticData('node');
        webhookData.webhookId = endpointId;
        if (secret) {
          webhookData.secret = secret;
        }

        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const endpointId = webhookData.webhookId as string | undefined;

        if (!endpointId) {
          return true;
        }

        try {
          await memberPassApiRequest.call(
            this,
            'DELETE',
            `/webhook-subscriptions/${endpointId}`,
            undefined,
            undefined,
            {
              headers: {
                'Idempotency-Key': `n8n-${this.getNode().name}-${endpointId}-delete`,
              },
            },
          );
        } catch (error) {
          const status = (error as { httpCode?: string | number }).httpCode;
          if (String(status) !== '404') {
            throw error;
          }
        }

        delete webhookData.webhookId;
        delete webhookData.secret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const verify = this.getNodeParameter('verifySignature', true) as boolean;
    const req = this.getRequestObject();
    const body = req.body as IDataObject;

    if (verify) {
      const webhookData = this.getWorkflowStaticData('node');
      const secret = webhookData.secret as string | undefined;
      const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody;
      const signatureHeader =
        (req.headers['mp-signature'] as string | undefined) ||
        (req.headers['MP-Signature'] as string | undefined);

      if (secret && signatureHeader && rawBody) {
        if (!isValidSignature(signatureHeader, rawBody, secret)) {
          return { workflowData: [] };
        }
      }
    }

    if (!body || typeof body !== 'object') {
      return { workflowData: [] };
    }

    const selectedEvents = this.getNodeParameter('events') as string[];
    const eventType = body.type as string | undefined;

    if (eventType && selectedEvents.length > 0 && !selectedEvents.includes(eventType)) {
      return { workflowData: [] };
    }

    return {
      workflowData: [[{ json: body }]],
    };
  }
}

/**
 * Verify the `MP-Signature: t=<unix>,v1=<hex>` header against the raw
 * request body using the shared secret returned from create(). Uses a
 * constant-time compare so timing can't leak whether the digest matched.
 */
function isValidSignature(header: string, rawBody: Buffer | string, secret: string): boolean {
  const parts = header.split(',').reduce<Record<string, string>>((acc, segment) => {
    const [key, value] = segment.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  const signedPayload = `${timestamp}.${payload}`;
  const computed = createHmac('sha256', secret).update(signedPayload).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(signature, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}
