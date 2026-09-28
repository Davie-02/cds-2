---
title: Test
slug: test
published: true
---
If you mean **delete/disconnect a Render Blueprint**, there is an important distinction:

### 1. Disconnect the Blueprint only

In the Render Dashboard:

1. Open your **Render workspace**.
2. Go to **Blueprints** from the left sidebar. ([Render][1])
3. Open the Blueprint you want to remove.
4. Go to its **Settings**.
5. Choose the option to **Disconnect/Delete the Blueprint**.

Disconnecting the Blueprint **does not delete the services, databases, or other resources created by it**. Those resources remain in your Render account. ([Render API][2])

### 2. If you want everything deleted

If the Blueprint created something like:

* Web service
* PostgreSQL database
* Redis/Key Value
* Background worker
* Cron job

you need to **delete those resources separately** after disconnecting the Blueprint. Render specifically keeps resources when a Blueprint is disconnected to prevent accidental deletion. ([Render][3])

### 3. If you only want to stop the Blueprint from deploying automatically

You don't need to delete it.

Go to the Blueprint's **Settings → Auto Sync → No**. This stops automatic synchronization when you push changes to the connected Git branch. ([Render][3])

**If your goal is to completely clean up a project you deployed on Render,** tell me whether you want to **delete only the Blueprint** or **delete the Blueprint + all its services/database**, and I'll give you the exact sequence so you don't accidentally leave anything running.

[1]: https://render.com/docs/render-dashboard?utm_source=chatgpt.com "The Render Dashboard – Render Docs"
[2]: https://api-docs.render.com/reference/disconnect-blueprint?utm_source=chatgpt.com "Disconnect Blueprint"
[3]: https://render.com/docs/infrastructure-as-code?utm_source=chatgpt.com "Render Blueprints (IaC) – Render Docs"
