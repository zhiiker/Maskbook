import { useContext } from 'react'
import { createStyles, makeStyles } from '@material-ui/core'
import { Markdown } from './Markdown'
import { useProposal } from '../hooks/useProposal'
import { SnapshotContext } from '../context'

const useStyles = makeStyles((theme) => {
    return createStyles({})
})

export interface ReadMeCardProps {}

export function ReadMeCard(props: ReadMeCardProps) {
    const identifier = useContext(SnapshotContext)
    const {
        payload: { message },
    } = useProposal(identifier.id)

    return <Markdown content={message.payload.body} />
}
