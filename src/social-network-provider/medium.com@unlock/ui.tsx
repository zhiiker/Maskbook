import { defineSocialNetworkUI, getEmptyPostInfoByElement } from '../../social-network/ui'
import { LiveSelector, MutationObserverWatcher } from '@holoflows/kit/es'
import { sharedSettingsMediumUnlock } from '.'
import { renderInShadowRoot } from '../../utils/jss/renderInShadowRoot'
import React from 'react'
import { MediumUnlockInspectPost } from './inspect-post'
import { AdditionalPostBoxUI } from '../../components/InjectedComponents/AdditionalPostBox'
import { generate_AES_GCM_256_Key } from '../../utils/crypto.subtle'
import { encodeText, encodeArrayBuffer } from '../../utils/type-transform/String-ArrayBuffer'
import { constructAlpha38, deconstructPayload } from '../../utils/type-transform/Payload'
import { ProfileIdentifier } from '../../database/type'
import { Profile, Group } from '../../database'

export const mediumUnlockUI = defineSocialNetworkUI({
    ...sharedSettingsMediumUnlock,
    taskUploadToPostBox: () => {},
    requestPermission: () => {
        return browser.permissions.request({
            origins: [`https://*.medium.com/*`],
        })
    },
    init: (env, pref) => {},
    shouldActivate(location: Location | URL = globalThis.location) {
        return location.hostname.endsWith('medium.com')
    },
    friendlyName: 'Medium (For Unlock)',
    setupAccount: () => {},
    ignoreSetupAccount() {},
    shouldDisplayWelcome: async () => false,
    taskGetPostContent: async () => '',
    taskGetProfile: async () => {
        throw new Error('')
    },
    taskPasteIntoBio: async () => '',
    taskPasteIntoPostBox: async () => '',
    injectPostBox: () => {
        const ls = new LiveSelector().querySelector<HTMLElement>('[contenteditable]').enableSingleMode()
        const mow = new MutationObserverWatcher(ls).setDOMProxyOption({
            beforeShadowRootInit: { mode: 'closed' },
            afterShadowRootInit: { mode: 'closed' },
        })
        async function onRequest(_: unknown, text: string) {
            const aes = await generate_AES_GCM_256_Key()
            const content = encodeText(text)
            const iv = crypto.getRandomValues(new Uint8Array(16))
            const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, content)
            prompt(
                'Please publish this AES key on the Unlock',
                JSON.stringify(await crypto.subtle.exportKey('jwk', aes)),
            )
            const payload = constructAlpha38(
                {
                    AESKeyEncrypted: '_',
                    encryptedText: encodeArrayBuffer(encryptedContent),
                    iv: encodeArrayBuffer(iv),
                    signature: '_',
                    version: -38,
                },
                x => x,
            )
            prompt('Please paste the content to the box', 'Unlock + Maskbook:' + payload)
        }
        function UI() {
            const [target, set1] = React.useState([] as Array<Profile | Group>)
            const [text, set2] = React.useState('')
            const maskbook: Profile = {
                identifier: new ProfileIdentifier('medium.com@unlock', '_'),
                nickname: 'Share with Maskbook',
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            return (
                <>
                    <AdditionalPostBoxUI
                        onShareTargetChanged={x => set1(x)}
                        onPostTextChange={x => set2(x)}
                        onPostButtonClicked={() => onRequest(target, text)}
                        availableShareTarget={[maskbook]}
                        currentShareTarget={[maskbook]}
                        currentIdentity={null}
                        postBoxPlaceholder="Share with Unlock!"
                        postBoxText={text}
                        postButtonDisabled={text.length === 0}
                    />
                </>
            )
        }
        const unmount = renderInShadowRoot(<UI />, mow.firstDOMProxy.afterShadow)
        mow.startWatch({ subtree: true, childList: true })
        return () => {
            unmount()
            mow.stopWatch()
        }
    },
    injectPostInspector(current) {
        return renderInShadowRoot(
            <MediumUnlockInspectPost content={current.postContent}></MediumUnlockInspectPost>,
            current.rootNodeProxy.beforeShadow,
        )
    },
    resolveLastRecognizedIdentity: () => {},
    collectPeople: () => {},
    collectPosts: () => {
        const postSelector = new LiveSelector().querySelectorAll<HTMLElement>('[data-selectable-paragraph]')
        new MutationObserverWatcher(postSelector)
            .useForeach((node, key, meta) => {
                const info = getEmptyPostInfoByElement({ rootNode: meta.realCurrent!, rootNodeProxy: meta })
                mediumUnlockUI.posts.set(node, info)
                info.postContent.addListener(v => {
                    info.postPayload.value = deconstructPayload(v, x => x)
                })
                function collectInfo() {
                    info.postContent.value = node.innerText
                }
                collectInfo()
                return {
                    onNodeMutation: collectInfo,
                    onRemove: () => mediumUnlockUI.posts.delete(node),
                }
            })
            .setDOMProxyOption({ beforeShadowRootInit: { mode: 'closed' }, afterShadowRootInit: { mode: 'closed' } })
            .startWatch({ subtree: true, childList: true, characterData: true })
    },
})
