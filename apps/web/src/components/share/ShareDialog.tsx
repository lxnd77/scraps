"use client";

import {
  createInvite,
  listInvites,
  listSpaceMembers,
  revokeInvite,
  type InviteRow,
  type SpaceMember,
  type SpaceRole,
} from "@scraps/db";
import { Avatar, Button, Dialog, type StickerId } from "@scraps/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";
import { relativeFuture } from "@/lib/relativeTime";
import { createClient } from "@/lib/supabase/client";
import { avatarColorFor } from "@/lib/presence";

interface Props {
  open: boolean;
  onClose: () => void;
  space: { id: string; name: string; role: SpaceRole };
}

/** Share dialog (SPEC 6.8): members, roles, invite links. */
export function ShareDialog({ open, onClose, space }: Props) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("share.title", { space: space.name })}>
      {open && <ShareBody space={space} onClose={onClose} />}
    </Dialog>
  );
}

function ShareBody({ space, onClose }: { space: Props["space"]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useShell();
  const isOwner = space.role === "owner";
  const canInvite = space.role === "owner" || space.role === "editor";
  const [error, setError] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const members = useQuery({
    queryKey: ["members", space.id],
    queryFn: () => listSpaceMembers(createClient(), space.id),
  });
  const invites = useQuery({
    queryKey: ["invites", space.id],
    queryFn: () => listInvites(createClient(), space.id),
    enabled: canInvite,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["members", space.id] });
    void queryClient.invalidateQueries({ queryKey: ["invites", space.id] });
    router.refresh();
  };

  const changeRole = useMutation({
    mutationFn: async (args: { userId: string; role: SpaceRole }) => {
      const { error: failure } = await createClient()
        .from("space_members")
        .update({ role: args.role })
        .eq("space_id", space.id)
        .eq("user_id", args.userId);
      if (failure) throw failure;
    },
    onSuccess: refresh,
    onError: () => setError(true),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error: failure } = await createClient()
        .from("space_members")
        .delete()
        .eq("space_id", space.id)
        .eq("user_id", userId);
      if (failure) throw failure;
      return userId;
    },
    onSuccess: (userId) => {
      if (userId === user.id) {
        onClose();
        router.push("/");
      }
      refresh();
    },
    onError: () => setError(true),
  });

  return (
    <div className="share">
      {error && (
        <p role="alert" className="field-error">
          {t("share.error")}
        </p>
      )}

      <section aria-labelledby="share-members">
        <h3 id="share-members" className="field-label">
          {t("share.members")}
        </h3>
        <ul className="share__members">
          {(members.data ?? []).map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              you={member.userId === user.id}
              canChangeRole={isOwner && member.role !== "owner" && member.userId !== user.id}
              canRemove={isOwner && member.role !== "owner" && member.userId !== user.id}
              onRole={(role) => changeRole.mutate({ userId: member.userId, role })}
              onRemove={() => remove.mutate(member.userId)}
            />
          ))}
        </ul>
      </section>

      {canInvite && (
        <InviteSection
          spaceId={space.id}
          isOwner={isOwner}
          invites={invites.data ?? []}
          onChanged={refresh}
          onError={() => setError(true)}
        />
      )}

      {space.role !== "owner" && (
        <div className="share__leave">
          {confirmLeave ? (
            <>
              <p className="note-menu__lead">{t("share.leave.confirm")}</p>
              <p className="field-hint">{t("share.leave.body")}</p>
              <div className="space-form__actions">
                <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
                  {t("space.cancel")}
                </Button>
                <Button variant="dark" onClick={() => remove.mutate(user.id)}>
                  <LogOut size={18} strokeWidth={2.6} aria-hidden="true" />
                  {t("share.leave")}
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              <LogOut size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("share.leave")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  you,
  canChangeRole,
  canRemove,
  onRole,
  onRemove,
}: {
  member: SpaceMember;
  you: boolean;
  canChangeRole: boolean;
  canRemove: boolean;
  onRole: (role: SpaceRole) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const name = member.displayName || t("share.you");
  return (
    <li className="share__member">
      <Avatar
        name={name}
        sticker={member.avatarSticker as StickerId}
        color={avatarColorFor(member.userId)}
        size={40}
      />
      <span className="share__name">
        {name}
        {you && <span className="sc-mono share__you"> · {t("share.you")}</span>}
      </span>
      {canChangeRole ? (
        <select
          className="share__select"
          aria-label={t("share.role.label", { name })}
          value={member.role}
          onChange={(event) => onRole(event.target.value as SpaceRole)}
        >
          <option value="editor">{t("share.role.editor")}</option>
          <option value="viewer">{t("share.role.viewer")}</option>
        </select>
      ) : (
        <span className="sc-mono share__role">
          {t(`share.role.${member.role}` as "share.role.owner")}
        </span>
      )}
      {canRemove && (
        <Button
          variant="icon"
          size="sm"
          aria-label={t("share.remove", { name })}
          onClick={onRemove}
        >
          <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

function InviteSection({
  spaceId,
  isOwner,
  invites,
  onChanged,
  onError,
}: {
  spaceId: string;
  isOwner: boolean;
  invites: InviteRow[];
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT();
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState(10);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const now = new Date();

  const create = useMutation({
    mutationFn: () =>
      createInvite(createClient(), { spaceId, role: isOwner ? role : "viewer", days, maxUses }),
    onSuccess: (token) => {
      setLink(`${window.location.origin}/invite/${token}`);
      setCopied(false);
      onChanged();
    },
    onError,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvite(createClient(), id),
    onSuccess: onChanged,
    onError,
  });

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // the link is in a read-only field; selecting it by hand still works
    }
  }

  return (
    <section aria-labelledby="share-invite" className="share__invite">
      <h3 id="share-invite" className="field-label">
        {t("share.invite.title")}
      </h3>
      {!isOwner && <p className="field-hint">{t("share.invite.viewer_only")}</p>}

      <div className="share__invite-form">
        {isOwner && (
          <label className="field">
            <span className="field-label">{t("share.invite.role")}</span>
            <select
              className="share__select"
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
            >
              <option value="viewer">{t("share.role.viewer")}</option>
              <option value="editor">{t("share.role.editor")}</option>
            </select>
          </label>
        )}
        <label className="field">
          <span className="field-label">{t("share.invite.expires")}</span>
          <select
            className="share__select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>{t("share.invite.days.1")}</option>
            <option value={7}>{t("share.invite.days.7")}</option>
            <option value={30}>{t("share.invite.days.30")}</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">{t("share.invite.uses")}</span>
          <input
            className="field-input share__uses"
            type="number"
            min={1}
            max={200}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.min(200, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {t("share.invite.create")}
        </Button>
      </div>

      {link && (
        <div className="share__new">
          <label className="field">
            <span className="field-label">{t("share.invite.new")}</span>
            <input
              className="field-input"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <Button variant="ghost" onClick={() => void copy()}>
            <Copy size={18} strokeWidth={2.6} aria-hidden="true" />
            {copied ? t("share.invite.copied") : t("share.invite.copy")}
          </Button>
        </div>
      )}

      <h4 className="field-label">{t("share.invite.list")}</h4>
      {invites.length === 0 ? (
        <p className="field-hint">{t("share.invite.none")}</p>
      ) : (
        <ul className="share__invites">
          {invites.map((invite) => (
            <li key={invite.id} className="share__invite-row">
              <span className="sc-mono">
                {t("share.invite.item", {
                  role: t(`share.role.${invite.role}` as "share.role.editor"),
                  uses: invite.uses,
                  max: invite.maxUses,
                  when: relativeFuture(invite.expiresAt, now),
                })}
              </span>
              <Button variant="ghost" onClick={() => revoke.mutate(invite.id)}>
                {t("share.invite.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
